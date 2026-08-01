import { useMemo, useState } from 'react';

import type { LnsCredentialsPayload } from '@shared/ipc';

import { LORAWAN_REGIONS, defaultRegionForLocale } from '../../../config/lorawan';
import {
  useConcentratorQuery,
  useProvisionGatewayMutation,
  useRegisterGatewayMutation,
} from '../../../services/api/lorawan/hooks/useGatewayQuery';

/**
 * Business layer for the LoRaWAN setup flow.
 *
 * Contract 5: the page renders what this returns and holds no policy. The
 * progress steps live here because they are domain steps, not layout.
 */

export type SetupStep = 'idle' | 'registering' | 'downloading' | 'installing' | 'starting' | 'done' | 'failed';

/** Plain sentences, not a log. English text used directly as i18n keys. */
export const STEP_LABEL: Record<Exclude<SetupStep, 'idle' | 'done' | 'failed'>, string> = {
  registering: 'Creating your gateway in Chirp…',
  downloading: 'Downloading security certificates…',
  installing: 'Installing certificates…',
  starting: 'Starting the gateway…',
};

export const useGatewaySetup = () => {
  const concentratorQuery = useConcentratorQuery();
  const registerMutation = useRegisterGatewayMutation();
  const provisionMutation = useProvisionGatewayMutation();

  const concentrator = concentratorQuery.data ?? null;

  const [name, setName] = useState('');
  const [region, setRegion] = useState(defaultRegionForLocale());
  const [step, setStep] = useState<SetupStep>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [technicalDetail, setTechnicalDetail] = useState<string | null>(null);

  // Contract 2 rule 3: the name is pre-filled from the hostname the user already
  // recognises, so the field is confirmable rather than a blank prompt.
  const suggestedName = useMemo(() => name || `Chirp Hub — ${window.location.hostname || 'gateway'}`, [name]);

  const handleNameChange = (value: string) => setName(value);
  const handleRegionChange = (value: string) => setRegion(value);

  const handleRegister = async () => {
    if (!concentrator) return;

    setErrorMessage(null);
    setTechnicalDetail(null);
    setStep('registering');

    const registered = await registerMutation.mutateAsync({
      eui: concentrator.eui,
      name: suggestedName,
      region,
    });

    if (!registered.ok) {
      setStep('failed');
      setErrorMessage(registered.error.message);
      setTechnicalDetail(registered.error.technicalDetail ?? null);
      return;
    }

    setStep('installing');

    const credentials: LnsCredentialsPayload = registered.value;
    const provisioned = await provisionMutation.mutateAsync(credentials);

    if (!provisioned.ok) {
      setStep('failed');
      setErrorMessage(provisioned.error.message);
      setTechnicalDetail(provisioned.error.technicalDetail ?? null);
      return;
    }

    setStep('done');
  };

  return {
    concentrator,
    isDetecting: concentratorQuery.isLoading,
    name: suggestedName,
    region,
    regions: LORAWAN_REGIONS,
    step,
    errorMessage,
    technicalDetail,
    isBusy: step === 'registering' || step === 'downloading' || step === 'installing' || step === 'starting',
    handleNameChange,
    handleRegionChange,
    handleRegister,
  };
};
