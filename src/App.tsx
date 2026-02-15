import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { CreateWorkout } from "./pages/workouts/CreateWorkout";
import { WorkoutHistory } from "./pages/workouts/WorkoutHistory";
import { WorkoutDetail } from "./pages/workouts/WorkoutDetail";
import { ExerciseList } from "./pages/exercises/ExerciseList";
import { ExerciseDetail } from "./pages/exercises/ExerciseDetail";
import { DayList } from "./pages/days/DayList";
import { DayDetail } from "./pages/days/DayDetail";
import { ExportPage } from "./pages/export/ExportPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
            <Route index element={<Navigate to="/workouts/new" replace />} />
            <Route path="workouts/new" element={<CreateWorkout />} />
            <Route path="workouts" element={<WorkoutHistory />} />
            <Route path="workouts/:id" element={<WorkoutDetail />} />
            <Route path="exercises" element={<ExerciseList />} />
            <Route path="exercises/:id" element={<ExerciseDetail />} />
            <Route path="days" element={<DayList />} />
            <Route path="days/:id" element={<DayDetail />} />
            <Route path="export" element={<ExportPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
