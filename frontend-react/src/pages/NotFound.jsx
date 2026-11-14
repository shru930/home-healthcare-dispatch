import { Link } from 'react-router-dom';
import { EmptyState } from '../components/Feedback.jsx';

export default function NotFound() {
  return (
    <EmptyState title="Page not found">
      <Link to="/" className="text-brand-700 underline">Back to dashboard</Link>
    </EmptyState>
  );
}
