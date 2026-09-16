import { type BarcodeScanningResult, Camera, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { Loading } from '@/components/common/Loading';
import { type AttendanceScanPhase, AttendanceScanView } from '@/components/ganaps/AttendanceScanView';
import { Routes } from '@/constants/routes';
import { type CheckInOutcome, useCheckInMutation } from '@/hooks/mutations/useGanapMutation';
import { useGanapDetailQuery } from '@/hooks/queries/useGanapsQuery';
import type { CheckInErrorModel } from '@/utils/attendance';
import { mapCheckInError } from '@/utils/attendance';

/** Error kinds that allow an immediate rescan. */
const RESCAN_KINDS = new Set(['invalid-qr', 'retryable', 'unknown']);

const IMAGE_NO_QR_ERROR: CheckInErrorModel = {
  kind: 'unknown',
  title: 'No attendance QR found',
  message: "Choose an image that clearly shows the organizer's attendance QR code and try again.",
};

const IMAGE_SCAN_ERROR: CheckInErrorModel = {
  kind: 'unknown',
  title: 'Could not read that image',
  message: 'We could not read the selected image. Choose another image and try again.',
};

/**
 * Attendance scanner for one Ganap: camera permission, live or image-based QR
 * capture, submission, and the recorded/queued/error outcomes as one internal
 * state machine.
 *
 * The confirmation is a phase of this route rather than its own screen so a
 * transient outcome is never deep-linkable.
 *
 * @returns The scanner screen in its current phase.
 */
export default function AttendanceScanScreen(): ReactElement {
  const { 'ganap-id': ganapId } = useLocalSearchParams<{ 'ganap-id': string }>();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const detail = useGanapDetailQuery(ganapId);
  const checkIn = useCheckInMutation();
  const [phase, setPhase] = useState<AttendanceScanPhase>({ name: 'scanning' });
  // A QR is re-read on every camera frame; only the first read may submit.
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  function handleBack(): void {
    if (router.canDismiss()) {
      router.dismiss();
      return;
    }
    router.back();
  }

  function handleBarcodeScanned(data: string): void {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setPhase({ name: 'submitting' });

    checkIn.mutate(
      { ganapId, qrHash: data, scannedAt: new Date().toISOString() },
      {
        onSuccess: (outcome: CheckInOutcome): void => {
          if (outcome.kind === 'recorded') {
            setPhase({ name: 'recorded' });
          } else {
            setPhase({ name: 'queued' });
          }
        },
        onError: (error: Error): void => {
          const model = mapCheckInError(error);
          if (model.kind === 'already-recorded') {
            setPhase({ name: 'recorded' });
            return;
          }
          setPhase({ name: 'error', model, canRescan: RESCAN_KINDS.has(model.kind) });
        },
      },
    );
  }

  async function handlePickImage(): Promise<void> {
    if (hasSubmittedRef.current || phase.name !== 'scanning') return;

    setPhase({ name: 'picking-image' });

    try {
      const result: ImagePicker.ImagePickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 1,
      });

      if (result.canceled) {
        setPhase({ name: 'scanning' });
        return;
      }

      const asset = result.assets[0];
      if (!asset) {
        setPhase({ name: 'error', model: IMAGE_NO_QR_ERROR, canRescan: true });
        return;
      }

      const scanResults: BarcodeScanningResult[] = await Camera.scanFromURLAsync(asset.uri, ['qr']);
      const qrResult: BarcodeScanningResult | undefined = scanResults.find(
        (result: BarcodeScanningResult): boolean => result.data.trim().length > 0,
      );

      if (!qrResult) {
        setPhase({ name: 'error', model: IMAGE_NO_QR_ERROR, canRescan: true });
        return;
      }

      handleBarcodeScanned(qrResult.data);
    } catch {
      setPhase({ name: 'error', model: IMAGE_SCAN_ERROR, canRescan: true });
    }
  }

  function handleScanAgain(): void {
    hasSubmittedRef.current = false;
    setPhase({ name: 'scanning' });
  }

  const handleGiveFeedback = useCallback((): void => {
    router.replace(Routes.ganapFeedback(ganapId));
  }, [ganapId, router]);

  if (!permission) return <Loading />;
  if (!permission.granted && !permission.canAskAgain) {
    return (
      <AttendanceScanView
        phase={{ name: 'permission-denied' }}
        eventTitle={detail.data?.title ?? null}
        onBarcodeScanned={handleBarcodeScanned}
        onPickImage={handlePickImage}
        onScanAgain={handleScanAgain}
        onOpenSettings={(): Promise<void> => Linking.openSettings()}
        onBack={handleBack}
        onGiveFeedback={handleGiveFeedback}
      />
    );
  }
  if (!permission.granted) return <Loading />;

  return (
    <AttendanceScanView
      phase={phase}
      eventTitle={detail.data?.title ?? null}
      onBarcodeScanned={handleBarcodeScanned}
      onPickImage={handlePickImage}
      onScanAgain={handleScanAgain}
      onOpenSettings={(): Promise<void> => Linking.openSettings()}
      onBack={handleBack}
      onGiveFeedback={handleGiveFeedback}
    />
  );
}
