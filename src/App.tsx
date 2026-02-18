import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoadingSpinner } from "./components/LoadingSpinner";

const Login = lazy(() =>
  import("./pages/Login").then((m) => ({ default: m.Login }))
);
const WorkoutHistory = lazy(() =>
  import("./pages/workouts/WorkoutHistory").then((m) => ({
    default: m.WorkoutHistory,
  }))
);
const WorkoutDetail = lazy(() =>
  import("./pages/workouts/WorkoutDetail").then((m) => ({
    default: m.WorkoutDetail,
  }))
);
const ExerciseList = lazy(() =>
  import("./pages/exercises/ExerciseList").then((m) => ({
    default: m.ExerciseList,
  }))
);
const ExerciseDetail = lazy(() =>
  import("./pages/exercises/ExerciseDetail").then((m) => ({
    default: m.ExerciseDetail,
  }))
);
const DayList = lazy(() =>
  import("./pages/days/DayList").then((m) => ({ default: m.DayList }))
);
const DayDetail = lazy(() =>
  import("./pages/days/DayDetail").then((m) => ({ default: m.DayDetail }))
);
const SettingsPage = lazy(() =>
  import("./pages/settings/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  }))
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
              <LoadingSpinner />
            </div>
          }
        >
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/workouts" replace />} />
              <Route path="workouts" element={<WorkoutHistory />} />
              <Route path="workouts/:id" element={<WorkoutDetail />} />
              <Route path="exercises" element={<ExerciseList />} />
              <Route path="exercises/:id" element={<ExerciseDetail />} />
              <Route path="days" element={<DayList />} />
              <Route path="days/:id" element={<DayDetail />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
