import { useState } from 'react';
import api from '../api.js';
import { useToast } from './Toast.jsx';

/** Publishes the MedicationDelivered Camunda message for a DISPATCHED delivery. */
export default function ConfirmDeliveryButton({ deliveryRef, onDone }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = async () => {
    setBusy(true);
    try {
      await api.confirmDelivery(deliveryRef);
      toast.success(`Delivery ${deliveryRef} confirmed (MedicationDelivered message published)`);
      onDone?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="btn-primary whitespace-nowrap" disabled={busy} onClick={confirm}>
      {busy ? 'Confirming...' : 'Confirm delivery'}
    </button>
  );
}
