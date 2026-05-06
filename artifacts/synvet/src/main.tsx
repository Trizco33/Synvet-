import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";
import { supabase } from "./lib/supabase";

setAuthTokenGetter(async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
});

createRoot(document.getElementById("root")!).render(<App />);
