import React, { useEffect, useRef, useState } from 'react';
import DailyOfferingEmptyEnvelope from './DailyOfferingEmptyEnvelope';
import DailyOfferingModal from './DailyOfferingModal';
import {
  dismissTodayDailyOffering,
  getDailyOfferingConfig,
  prepareTodayDailyOffering
} from './dailyOfferingService';

export const DailyOfferingHubGate = ({ children, onOpenSettings }) => {
  const hasLoadedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isPreparing, setIsPreparing] = useState(false);
  const [hasConfiguredCharacter, setHasConfiguredCharacter] = useState(false);
  const [offering, setOffering] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadDailyOffering = async () => {
      if (hasLoadedRef.current) return;
      hasLoadedRef.current = true;

      try {
        const config = await getDailyOfferingConfig();

        if (!config.characterId) {
          if (isMounted) {
            setHasConfiguredCharacter(false);
          }
          return;
        }

        if (isMounted) {
          setHasConfiguredCharacter(true);
          setIsPreparing(true);
        }

        const nextOffering = await prepareTodayDailyOffering();

        if (isMounted && nextOffering?.isDismissedByUser !== true) {
          setOffering(nextOffering || null);
        }
      } catch (error) {
        console.error('Unable to prepare daily offering:', error);
      } finally {
        if (isMounted) {
          setIsPreparing(false);
          setIsLoading(false);
        }
      }
    };

    void loadDailyOffering();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDismiss = async () => {
    try {
      await dismissTodayDailyOffering();
      setOffering(null);
    } catch (error) {
      console.error('Unable to dismiss daily offering:', error);
    }
  };

  return (
    <>
      {!isLoading && !hasConfiguredCharacter && (
        <DailyOfferingEmptyEnvelope onOpenSettings={onOpenSettings} />
      )}

      {children}

      {isPreparing && <DailyOfferingModal isPreparing />}

      {offering && (
        <DailyOfferingModal offering={offering} onDismiss={handleDismiss} />
      )}
    </>
  );
};

export default DailyOfferingHubGate;
