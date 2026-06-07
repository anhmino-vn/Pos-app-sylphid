import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { HealthRecordsPage } from './health/HealthRecordsPage';
import { TreatmentPlansPage } from './health/TreatmentPlansPage';
import { TherapyLogsPage } from './health/TherapyLogsPage';
import { EvaluationsPage } from './health/EvaluationsPage';

export function Health() {
  const location = useLocation();
  const path = location.pathname;

  if (path.startsWith('/health/treatments')) return <TreatmentPlansPage />;
  if (path.startsWith('/health/logs')) return <TherapyLogsPage />;
  if (path.startsWith('/health/evaluations')) return <EvaluationsPage />;
  if (path.startsWith('/health/records')) return <HealthRecordsPage />;
  return <Navigate to="/health/records" replace />;
}
