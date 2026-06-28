import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export function NotFound() {
  return (
    <div className="container-narrow">
      <div className="card card-lg">
        <EmptyState icon="Search" title="We couldn’t find that page">
          The link may be stale. Head back to the overview to find your way.
        </EmptyState>
        <div className="row" style={{ justifyContent: 'center', marginTop: '1rem' }}>
          <Link to="/" className="btn btn-primary">Back to overview</Link>
        </div>
      </div>
    </div>
  );
}
