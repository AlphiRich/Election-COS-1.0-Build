/**
 * Election Campaign OS — route table
 * IC-ECOS-BUILD-2026-V2 §3.2. Mirrors the nav table plus the sub-views
 * absorbed under it (not top-level nav): seat calculator, threshold
 * analyzer, scheduled reports, municipality config, permissions,
 * ppfa-thresholds, gatherings advisory.
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Shell } from './Shell';
import { WarRoomPage } from '@/modules/war-room/WarRoomPage';
import { VotersPage } from '@/modules/voters/VotersPage';
import { BulkImportPage } from '@/modules/voters/BulkImportPage';
import { RoundPage } from '@/modules/voters/RoundPage';
import { ReportIncidentPage } from '@/modules/incidents/ReportIncidentPage';
import { WardsPage } from '@/modules/wards/WardsPage';
import { WardDetailPage } from '@/modules/wards/WardDetailPage';
import { FieldDiaryPage } from '@/modules/field-diary/FieldDiaryPage';
import { GatheringsPage } from '@/modules/gatherings/GatheringsPage';
import { IncidentsPage } from '@/modules/incidents/IncidentsPage';
import { LogisticsPage } from '@/modules/logistics/LogisticsPage';
import { FinancePage } from '@/modules/finance/FinancePage';
import { AnalyticsPage } from '@/modules/analytics/AnalyticsPage';
import { SeatCalculatorPage } from '@/modules/analytics/SeatCalculatorPage';
import { ThresholdAnalyzerPage } from '@/modules/analytics/ThresholdAnalyzerPage';
import { ScheduledReportsPage } from '@/modules/analytics/ScheduledReportsPage';
import { BuildReviewPage } from '@/modules/analytics/BuildReviewPage';
import { WardComparisonPage } from '@/modules/analytics/WardComparisonPage';
import { CandidateListPage } from '@/modules/reference/CandidateListPage';
import { VdLocatorPage } from '@/modules/reference/VdLocatorPage';
import { VoterStatisticsPage } from '@/modules/reference/VoterStatisticsPage';
import { PollsPage } from '@/modules/polls/PollsPage';
import { ScenarioRunnerPage } from '@/modules/analytics/ScenarioRunnerPage';
import { AnalystPage } from '@/modules/analyst/AnalystPage';
import { DrillDownPage } from '@/modules/drilldown/DrillDownPage';
import { HubPage } from '@/modules/hub/HubPage';
import { Lge2026ResultsPage } from '@/modules/lge2026/Lge2026ResultsPage';
import { PartyProfilePage } from '@/modules/lge2026/PartyProfilePage';
import { VoterIntelligencePage } from '@/modules/lge2026/VoterIntelligencePage';
import { SettingsPage } from '@/modules/settings/SettingsPage';
import { MunicipalityConfigPage } from '@/modules/settings/MunicipalityConfigPage';
import { PermissionsPage } from '@/modules/settings/PermissionsPage';
import { PPFAThresholdsPage } from '@/modules/settings/PPFAThresholdsPage';
import { DataSubjectRequestsPage } from '@/modules/settings/DataSubjectRequestsPage';
import { CandidatesPage } from '@/modules/candidates/CandidatesPage';
import { SubscriptionPage } from '@/modules/settings/SubscriptionPage';
import { AuditLogPage } from '@/modules/settings/AuditLogPage';
import { IncidentReportPage } from '@/modules/incidents/report/IncidentReportPage';
import { GatheringsAdvisoryPage } from '@/modules/knowledge/GatheringsAdvisoryPage';
import { RollFieldPage } from '@/modules/roll/RollFieldPage';
import { ElectionTimetablePage } from '@/modules/knowledge/ElectionTimetablePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to="/war-room" replace /> },
      { path: 'war-room', element: <WarRoomPage /> },
      { path: 'voters', element: <VotersPage /> },
      { path: 'voters/import', element: <BulkImportPage /> },
      { path: 'round', element: <RoundPage /> },
      { path: 'roll', element: <RollFieldPage /> },
      { path: 'incidents/new', element: <ReportIncidentPage /> },
      { path: 'incidents/report', element: <IncidentReportPage /> },
      { path: 'wards', element: <WardsPage /> },
      { path: 'wards/:wardCode', element: <WardDetailPage /> },
      { path: 'diary', element: <FieldDiaryPage /> },
      { path: 'gatherings', element: <GatheringsPage /> },
      { path: 'incidents', element: <IncidentsPage /> },
      { path: 'logistics', element: <LogisticsPage /> },
      { path: 'finance', element: <FinancePage /> },
      {
        path: 'analytics',
        children: [
          { index: true, element: <AnalyticsPage /> },
          { path: 'seat-calculator', element: <SeatCalculatorPage /> },
          { path: 'thresholds', element: <ThresholdAnalyzerPage /> },
          { path: 'scheduled-reports', element: <ScheduledReportsPage /> },
          { path: 'ward-comparison', element: <WardComparisonPage /> },
          { path: 'scenario-runner', element: <ScenarioRunnerPage /> },
          { path: 'analyst', element: <AnalystPage /> },
          { path: 'drill-down', element: <DrillDownPage /> },
          { path: 'hub', element: <HubPage /> },
          { path: 'lge-2026-results', element: <Lge2026ResultsPage /> },
          { path: 'lge-2026-party', element: <PartyProfilePage /> },
          { path: 'voter-intelligence', element: <VoterIntelligencePage /> },
          { path: 'polls', element: <PollsPage /> },
          { path: 'candidate-list', element: <CandidateListPage /> },
          { path: 'vd-locator', element: <VdLocatorPage /> },
          { path: 'voter-statistics', element: <VoterStatisticsPage /> },
          { path: 'build-review', element: <BuildReviewPage /> },
        ],
      },
      {
        path: 'settings',
        children: [
          { index: true, element: <SettingsPage /> },
          { path: 'municipality', element: <MunicipalityConfigPage /> },
          { path: 'permissions', element: <PermissionsPage /> },
          { path: 'ppfa-thresholds', element: <PPFAThresholdsPage /> },
          { path: 'data-requests', element: <DataSubjectRequestsPage /> },
          { path: 'candidates', element: <CandidatesPage /> },
          { path: 'subscription', element: <SubscriptionPage /> },
          { path: 'audit', element: <AuditLogPage /> },
        ],
      },
      { path: 'knowledge/gatherings-advisory', element: <GatheringsAdvisoryPage /> },
      { path: 'knowledge/election-timetable', element: <ElectionTimetablePage /> },
    ],
  },
]);
