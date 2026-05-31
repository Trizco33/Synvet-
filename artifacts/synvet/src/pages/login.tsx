import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/use-auth";
import { signupUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import logoUrl from "@assets/synvet-logo.png";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const loginSchema = z.object({
  email: z.string().email({ message: "E-mail inválido" }),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres" }),
});

const signUpSchema = z.object({
  name: z.string().min(2, { message: "Informe seu nome completo" }),
  clinicName: z.string().min(2, { message: "Informe o nome da clínica" }),
  email: z.string().email({ message: "E-mail inválido" }),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres" }),
  passwordConfirm: z.string().min(6, { message: "Confirme a senha" }),
}).refine((d) => d.password === d.passwordConfirm, {
  message: "As senhas não coincidem",
  path: ["passwordConfirm"],
});

const recoverSchema = z.object({
  email: z.string().email({ message: "E-mail inválido" }),
});

type Tab = "login" | "signup";

/**
 * Sincroniza valores preenchidos por gerenciadores de senha / autofill que
 * alteram o DOM sem disparar eventos React (comum no Chrome Android e em
 * gerenciadores de senha). Sem isso, o react-hook-form fica com o estado vazio
 * e o submit é bloqueado silenciosamente — o usuário clica e "nada acontece".
 */
function syncAutofilledValues(
  root: HTMLFormElement | null,
  form: { getValues: (name: never) => unknown; setValue: (name: never, value: never, opts?: never) => void },
  names: readonly string[],
) {
  if (!root) return;
  for (const name of names) {
    const el = root.querySelector(`input[name="${name}"]`) as HTMLInputElement | null;
    if (el && el.value !== (form.getValues(name as never) as string)) {
      form.setValue(name as never, el.value as never, {
        shouldValidate: false,
        shouldDirty: true,
      } as never);
    }
  }
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { signInWithPassword, resetPassword, configured } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [tab, setTab] = useState<Tab>("login");
  const loginFormRef = useRef<HTMLFormElement>(null);
  const signUpFormRef = useRef<HTMLFormElement>(null);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signUpForm = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", clinicName: "", email: "", password: "", passwordConfirm: "" },
  });

  const recoverForm = useForm<z.infer<typeof recoverSchema>>({
    resolver: zodResolver(recoverSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    try {
      const { error } = await signInWithPassword(values.email, values.password);
      if (error) {
        toast.error("Erro ao entrar", { description: error });
      } else {
        toast.success("Login realizado com sucesso");
        setLocation("/app");
      }
    } catch (err) {
      toast.error("Erro ao entrar", {
        description: err instanceof Error ? err.message : "Falha inesperada. Tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSignUp = async (values: z.infer<typeof signUpSchema>) => {
    setIsLoading(true);
    try {
      await signupUser({
        email: values.email,
        password: values.password,
        name: values.name,
        clinicName: values.clinicName,
      });
      const { error } = await signInWithPassword(values.email, values.password);
      setIsLoading(false);
      if (error) {
        toast.error("Conta criada, mas falhou ao entrar", { description: error });
        setTab("login");
        form.setValue("email", values.email);
      } else {
        toast.success("Conta criada com sucesso");
        setLocation("/app");
      }
    } catch (err: unknown) {
      setIsLoading(false);
      const msg =
        err && typeof err === "object" && "data" in err && (err as { data?: { error?: string } }).data?.error
          ? (err as { data: { error: string } }).data.error
          : "Não foi possível criar a conta. Tente novamente.";
      toast.error("Erro ao criar conta", { description: msg });
    }
  };

  const onRecoverSubmit = async (values: z.infer<typeof recoverSchema>) => {
    setIsRecovering(true);
    const { error } = await resetPassword(values.email);
    setIsRecovering(false);
    if (error) {
      toast.error("Não foi possível enviar o e-mail", { description: error });
    } else {
      toast.success("E-mail de recuperação enviado", {
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
      setRecoverOpen(false);
      recoverForm.reset();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md border-border/50 shadow-2xl bg-card/80 backdrop-blur-sm z-10">
        <CardHeader className="space-y-3 text-center pb-6 pt-10">
          <img src={logoUrl} alt="Synvet" className="mx-auto h-16 w-auto mb-2" />
          <CardDescription className="text-base">
            O sistema operacional da sua clínica veterinária.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-10">
          {!configured && (
            <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg text-sm flex flex-col gap-2">
              <span className="font-semibold text-primary">Modo de Demonstração Ativo</span>
              <span className="text-muted-foreground">
                O Supabase não está configurado. Você pode entrar com qualquer dado para explorar o app.
              </span>
              <Button
                variant="default"
                className="mt-2 w-full"
                onClick={() => setLocation("/app")}
                data-testid="button-demo-login"
              >
                Acessar Demonstração
              </Button>
            </div>
          )}

          {configured && (
            <div className="flex rounded-lg border border-border/50 p-1 mb-6 bg-muted/30">
              <button
                type="button"
                onClick={() => setTab("login")}
                className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
                  tab === "login"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setTab("signup")}
                className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
                  tab === "signup"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Criar conta
              </button>
            </div>
          )}

          {tab === "login" && (
            <Form {...form}>
              <form
                ref={loginFormRef}
                onSubmit={(e) => {
                  syncAutofilledValues(loginFormRef.current, form, ["email", "password"]);
                  void form.handleSubmit(onSubmit)(e);
                }}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="username"
                          placeholder="seu@email.com"
                          {...field}
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Senha</FormLabel>
                        <button
                          type="button"
                          onClick={() => setRecoverOpen(true)}
                          className="text-xs text-primary hover:underline"
                          data-testid="button-forgot-password"
                        >
                          Esqueci minha senha
                        </button>
                      </div>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          placeholder="••••••••"
                          {...field}
                          data-testid="input-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium"
                  disabled={isLoading}
                  data-testid="button-submit-login"
                >
                  {isLoading ? "Entrando..." : "Entrar na Clínica"}
                </Button>
              </form>
            </Form>
          )}

          {tab === "signup" && (
            <Form {...signUpForm}>
              <form
                ref={signUpFormRef}
                onSubmit={(e) => {
                  syncAutofilledValues(signUpFormRef.current, signUpForm, [
                    "name",
                    "clinicName",
                    "email",
                    "password",
                    "passwordConfirm",
                  ]);
                  void signUpForm.handleSubmit(onSignUp)(e);
                }}
                className="space-y-4"
              >
                <FormField
                  control={signUpForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seu nome completo</FormLabel>
                      <FormControl>
                        <Input autoComplete="name" placeholder="Dr. João Silva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpForm.control}
                  name="clinicName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da clínica</FormLabel>
                      <FormControl>
                        <Input autoComplete="organization" placeholder="Clínica Veterinária Exemplo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" placeholder="seu@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpForm.control}
                  name="passwordConfirm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar senha</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? "Criando conta..." : "Criar conta"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <Dialog open={recoverOpen} onOpenChange={setRecoverOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              Informe o e-mail cadastrado para receber um link de redefinição.
            </DialogDescription>
          </DialogHeader>
          <Form {...recoverForm}>
            <form
              onSubmit={recoverForm.handleSubmit(onRecoverSubmit)}
              className="space-y-4"
            >
              <FormField
                control={recoverForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="seu@email.com"
                        {...field}
                        data-testid="input-recover-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRecoverOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isRecovering}
                  data-testid="button-submit-recover"
                >
                  {isRecovering ? "Enviando..." : "Enviar link"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
