import { describe, expect, it } from 'vitest';

import { describeDevice } from '../../../domain/radio';

import { identify } from './index';
import { parseByIdName } from './linux';
import { parseSystemProfiler, serialFromCalloutName } from './macos';
import { comPortFrom, parsePowerShellPorts, serialFromInstanceId } from './windows';

/**
 * Parsers are pure, so they can be tested against real output without the
 * hardware. The Linux sample is copied verbatim from the machine this was
 * written on; the macOS and Windows samples are recorded shapes and are
 * **unverified on real hardware** — that check needs a Mac and a PC.
 */

const LINUX_BY_ID = 'usb-SONOFF_SONOFF_Dongle_Plus_MG24_f620d69ac39aef11aa72ad9061ce3355-if00-port0';

describe('linux by-id parsing', () => {
  it('reads vendor, model and serial from the real dongle name', () => {
    expect(parseByIdName(LINUX_BY_ID)).toEqual({
      vendor: 'SONOFF',
      model: 'SONOFF Dongle Plus MG24',
      serial: 'f620d69ac39aef11aa72ad9061ce3355',
    });
  });

  /** The whole point: the shared registry must recognise it. */
  it('identifies that dongle as an ember coordinator from a known brand', () => {
    const parsed = parseByIdName(LINUX_BY_ID);
    expect(parsed).not.toBeNull();
    if (!parsed) return;

    const identified = identify({ node: '/dev/ttyUSB0', ...parsed });

    expect(identified.adapter).toBe('ember');
    expect(identified.known).toBe(true);
  });

  it('takes the serial from the end, since vendor and model contain underscores', () => {
    // Spaces become underscores, so splitting naively would put "Dongle" in the
    // serial and pin roles to something that changes with the product name.
    expect(parseByIdName(LINUX_BY_ID)?.serial).not.toContain('Dongle');
  });

  it('handles a device that publishes no serial number', () => {
    expect(parseByIdName('usb-Prolific_USB-Serial-if00-port0')).toEqual({
      vendor: 'Prolific',
      model: '',
      serial: 'USB-Serial',
    });
  });

  it('ignores anything that is not a usb- link', () => {
    expect(parseByIdName('pci-0000:00:16.3-port0')).toBeNull();
  });

  it('does not auto-claim a generic bridge with no brand', () => {
    // 10c4:ea60 is a CP2102 found on thousands of unrelated boards. Claiming
    // one as the Zigbee radio would be worse than asking.
    const identified = identify({ node: '/dev/ttyUSB0', vendor: 'Silicon_Labs', model: 'CP2102', serial: '0001' });

    expect(identified.known).toBe(false);
  });
});

describe('macos parsing', () => {
  const SAMPLE = JSON.stringify({
    SPUSBDataType: [
      {
        _name: 'USB31Bus',
        _items: [
          {
            _name: 'SONOFF Dongle Plus MG24',
            manufacturer: 'SONOFF',
            serial_num: 'f620d69ac39aef11aa72ad9061ce3355',
          },
        ],
      },
    ],
  });

  it('indexes nested USB devices by serial', () => {
    expect(parseSystemProfiler(SAMPLE).get('f620d69ac39aef11aa72ad9061ce3355')).toEqual({
      vendor: 'SONOFF',
      model: 'SONOFF Dongle Plus MG24',
    });
  });

  it('degrades to an empty index rather than throwing on bad output', () => {
    expect(parseSystemProfiler('not json').size).toBe(0);
  });

  it('extracts the serial from a callout device name', () => {
    expect(serialFromCalloutName('cu.usbserial-0001')).toBe('0001');
    expect(serialFromCalloutName('cu.usbmodem14201')).toBe('14201');
  });
});

describe('windows parsing', () => {
  const SAMPLE = JSON.stringify({
    Name: 'Silicon Labs CP210x USB to UART Bridge (COM3)',
    InstanceId: 'USB\\VID_10C4&PID_EA60\\f620d69ac39aef11aa72ad9061ce3355',
    BusDescription: 'SONOFF Dongle Plus MG24',
    Manufacturer: 'Silicon Labs',
  });

  it('reads a single port, which PowerShell emits as an object not an array', () => {
    expect(parsePowerShellPorts(SAMPLE)).toEqual([
      {
        node: 'COM3',
        vendor: 'Silicon Labs',
        model: 'SONOFF Dongle Plus MG24',
        serial: 'f620d69ac39aef11aa72ad9061ce3355',
      },
    ]);
  });

  /**
   * The trap this parser exists to avoid. The FriendlyName is the driver's and
   * says nothing about SONOFF or MG24, so identifying on it would leave every
   * Windows user with an unrecognised generic bridge.
   */
  it('identifies from the bus description, not the driver name', () => {
    const [device] = parsePowerShellPorts(SAMPLE);
    expect(device).toBeDefined();
    if (!device) return;

    const identified = identify(device);

    expect(identified.adapter).toBe('ember');
    expect(identified.known).toBe(true);

    const fromDriverName = identify({ ...device, model: 'Silicon Labs CP210x USB to UART Bridge' });
    expect(fromDriverName.adapter).toBeNull();
    expect(fromDriverName.known).toBe(false);
  });

  it('skips a port with no COM name', () => {
    expect(parsePowerShellPorts(JSON.stringify({ Name: 'Some device', InstanceId: 'X' }))).toEqual([]);
  });

  it('strips the interface suffix a composite device appends to its serial', () => {
    // Role pinning is by serial, so leaving &0000 on would break across replug.
    expect(serialFromInstanceId('USB\\VID_10C4&PID_EA60\\ABC123&0000')).toBe('ABC123');
  });

  it('reads the COM port off the end of the friendly name', () => {
    expect(comPortFrom('Silicon Labs CP210x USB to UART Bridge (COM12)')).toBe('COM12');
    expect(comPortFrom('No port here')).toBeNull();
  });
});

describe('device naming', () => {
  it('does not repeat a vendor that the model already carries', () => {
    // The dongle reports vendor SONOFF and product "SONOFF Dongle Plus MG24",
    // so a naive join reads "SONOFF SONOFF Dongle Plus MG24".
    expect(describeDevice('SONOFF', 'SONOFF Dongle Plus MG24')).toBe('SONOFF Dongle Plus MG24');
  });

  it('prepends a vendor the model does not carry', () => {
    expect(describeDevice('dresden elektronik', 'ConBee II')).toBe('dresden elektronik ConBee II');
  });

  it('copes with either half missing', () => {
    expect(describeDevice('SONOFF', '')).toBe('SONOFF');
    expect(describeDevice('', 'ConBee II')).toBe('ConBee II');
  });
});
