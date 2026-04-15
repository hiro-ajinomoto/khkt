import { Routes, Route } from 'react-router-dom';
import { AdminWorkspaceProvider } from './AdminWorkspaceContext';
import AdminLayout from './AdminLayout';
import AdminHomePage from './AdminHomePage';
import AdminTeachersPage from './AdminTeachersPage';
import AdminStudentsPage from './AdminStudentsPage';

export default function AdminApp() {
  return (
    <AdminWorkspaceProvider>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminHomePage />} />
          <Route path="users/teachers" element={<AdminTeachersPage />} />
          <Route path="users/students" element={<AdminStudentsPage />} />
        </Route>
      </Routes>
    </AdminWorkspaceProvider>
  );
}
