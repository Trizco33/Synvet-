import { useEffect } from "react";
import { useLocation } from "wouter";

export default function AdminIndex() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/admin/clinicas");
  }, [setLocation]);
  return null;
}
