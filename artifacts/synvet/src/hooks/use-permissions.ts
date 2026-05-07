import { useGetMe } from "@workspace/api-client-react";

export type Role = "admin" | "vet" | "assistant";

export function usePermissions() {
  const { data: me } = useGetMe();
  const role = (me?.role as Role | undefined) ?? "vet";
  const isAdmin = role === "admin";
  const isVet = role === "vet";
  const isAssistant = role === "assistant";

  return {
    me,
    role,
    isAdmin,
    isVet,
    isAssistant,
    can: {
      manageTeam: isAdmin,
      editClinic: isAdmin,
      writeClinical: isAdmin || isVet,
      viewClinical: true,
    },
  };
}
