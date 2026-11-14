import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Patients from './pages/Patients.jsx';
import Nurses from './pages/Nurses.jsx';
import Visits from './pages/Visits.jsx';
import Physio from './pages/Physio.jsx';
import Pharmacy from './pages/Pharmacy.jsx';
import Risk from './pages/Risk.jsx';
import Tasklist from './pages/Tasklist.jsx';
import Tracker from './pages/Tracker.jsx';
import TrackerList from './pages/TrackerList.jsx';
import Notifications from './pages/Notifications.jsx';
import Demo from './pages/Demo.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="patients" element={<Patients />} />
        <Route path="nurses" element={<Nurses />} />
        <Route path="visits" element={<Visits />} />
        <Route path="physio" element={<Physio />} />
        <Route path="pharmacy" element={<Pharmacy />} />
        <Route path="risk" element={<Risk />} />
        <Route path="tasks" element={<Tasklist />} />
        <Route path="tracker" element={<TrackerList />} />
        <Route path="tracker/:processInstanceKey" element={<Tracker />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="demo" element={<Demo />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
