import { useState } from 'react';
import { Field } from './Ui.jsx';

const EMPTY = {
  mrn: '', firstName: '', lastName: '', dateOfBirth: '', gender: '', phone: '', email: '',
  addressLine: '', city: 'Chennai', postalCode: '', latitude: '', longitude: '',
  familyContactName: '', familyContactPhone: '', familyContactEmail: '',
};

const SAMPLES = [
  { area: 'Velachery', addressLine: '14, 100 Feet Bypass Road, Velachery', postalCode: '600042', latitude: 12.9791, longitude: 80.2209 },
  { area: 'Adyar', addressLine: '22, Gandhi Nagar 2nd Main Road, Adyar', postalCode: '600020', latitude: 13.0012, longitude: 80.2565 },
  { area: 'T. Nagar', addressLine: '8, Usman Road, T. Nagar', postalCode: '600017', latitude: 13.0418, longitude: 80.2341 },
  { area: 'Tambaram', addressLine: '5, GST Road, Tambaram', postalCode: '600045', latitude: 12.9249, longitude: 80.1275 },
];
const FIRST = ['Lakshmi', 'Arjun', 'Meena', 'Karthik', 'Divya', 'Suresh'];
const LAST = ['Raghavan', 'Subramanian', 'Krishnan', 'Venkatesh', 'Balaji', 'Sundaram'];

export function samplePatient(now = Date.now()) {
  const i = now % SAMPLES.length;
  const s = SAMPLES[i];
  const first = FIRST[now % FIRST.length];
  const last = LAST[Math.floor(now / 7) % LAST.length];
  const digits = String(now).slice(-6);
  return {
    mrn: `MRN-${String(now).slice(-9)}`,
    firstName: first,
    lastName: last,
    dateOfBirth: '1958-06-15',
    gender: now % 2 ? 'FEMALE' : 'MALE',
    phone: `98400${digits.slice(0, 5)}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    addressLine: s.addressLine,
    city: 'Chennai',
    postalCode: s.postalCode,
    latitude: s.latitude,
    longitude: s.longitude,
    familyContactName: `${FIRST[(now + 1) % FIRST.length]} ${last}`,
    familyContactPhone: `98410${digits.slice(1, 6)}`,
    familyContactEmail: `family.${last.toLowerCase()}@example.com`,
  };
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TEN = /^\d{10}$/;

export function validatePatient(p) {
  const e = {};
  ['mrn', 'firstName', 'lastName', 'addressLine', 'city', 'familyContactName'].forEach((k) => {
    if (!String(p[k] ?? '').trim()) e[k] = 'Required';
  });
  if (p.mrn && p.mrn.length > 30) e.mrn = 'Max 30 characters';
  if (!p.dateOfBirth) e.dateOfBirth = 'Required';
  else if (new Date(p.dateOfBirth) >= new Date()) e.dateOfBirth = 'Must be in the past';
  if (!TEN.test(p.phone || '')) e.phone = 'Must be 10 digits';
  if (p.email && !EMAIL.test(p.email)) e.email = 'Invalid e-mail';
  if (!TEN.test(p.familyContactPhone || '')) e.familyContactPhone = 'Must be 10 digits';
  if (!EMAIL.test(p.familyContactEmail || '')) e.familyContactEmail = 'Valid e-mail required';
  const lat = Number(p.latitude);
  const lng = Number(p.longitude);
  if (p.latitude === '' || Number.isNaN(lat) || lat < -90 || lat > 90) e.latitude = 'Between -90 and 90';
  if (p.longitude === '' || Number.isNaN(lng) || lng < -180 || lng > 180) e.longitude = 'Between -180 and 180';
  return e;
}

export default function PatientForm({ onSubmit, submitting, onCancel }) {
  const [p, setP] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    const errs = validatePatient(p);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit({
      ...p,
      mrn: p.mrn.trim(),
      gender: p.gender || null,
      email: p.email || null,
      postalCode: p.postalCode || null,
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
    });
  };

  const input = (k, label, props = {}) => (
    <Field label={label} htmlFor={`pf-${k}`} error={errors[k]}>
      <input id={`pf-${k}`} className="input" value={p[k]} onChange={set(k)} {...props} />
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="flex justify-end">
        <button type="button" className="btn-secondary" onClick={() => { setP(samplePatient()); setErrors({}); }}>
          Fill sample data
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {input('mrn', 'MRN *')}
        {input('firstName', 'First name *')}
        {input('lastName', 'Last name *')}
        {input('dateOfBirth', 'Date of birth *', { type: 'date' })}
        <Field label="Gender" htmlFor="pf-gender">
          <select id="pf-gender" className="input" value={p.gender} onChange={set('gender')}>
            <option value="">-</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        {input('phone', 'Phone (10 digits) *', { inputMode: 'numeric', maxLength: 10 })}
        {input('email', 'E-mail', { type: 'email' })}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3">{input('addressLine', 'Address *')}</div>
        {input('city', 'City *')}
        {input('postalCode', 'Postal code')}
        <div className="grid grid-cols-2 gap-2">
          {input('latitude', 'Latitude *', { type: 'number', step: 'any' })}
          {input('longitude', 'Longitude *', { type: 'number', step: 'any' })}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {input('familyContactName', 'Family contact name *')}
        {input('familyContactPhone', 'Family phone (10 digits) *', { inputMode: 'numeric', maxLength: 10 })}
        {input('familyContactEmail', 'Family e-mail *', { type: 'email' })}
      </div>
      <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Registering...' : 'Register patient'}
        </button>
      </div>
    </form>
  );
}
