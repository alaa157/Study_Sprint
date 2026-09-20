import { Navigate, Route, Routes } from "react-router-dom";
import { Board } from "./routes/Board";
import { FindGroup } from "./routes/FindGroup";
import { Login } from "./routes/Login";
import { Room } from "./routes/Room";
import { ProtectedLayout } from "./components/ProtectedLayout";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/find" element={<FindGroup />} />
        <Route path="/room/:sid" element={<Room />} />
        <Route path="/board" element={<Board />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
