import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/use-auth";
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
import { Stethoscope } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const recoverSchema = z.object({
  email: z.string().email({ message: "E-mail inválido" }),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { signInWithPassword, resetPassword, configured } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const recoverForm = useForm<z.infer<typeof recoverSchema>>({
    resolver: zodResolver(recoverSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    const { error } = await signInWithPassword(values.email, values.password);
    setIsLoading(false);
    if (error) {
      toast.error("Erro ao entrar", { description: error });
    } else {
      toast.success("Login realizado com sucesso");
      setLocation("/");
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
        <CardHeader className="space-y-3 text-center pb-8 pt-10">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-2 shadow-inner border border-primary/20">
            <Stethoscope className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">Synvet</CardTitle>
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
                onClick={() => setLocation("/")}
                data-testid="button-demo-login"
              >
                Acessar Demonstração
              </Button>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input placeholder="seu@email.com" {...field} data-testid="input-email" />
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
                      <Input type="password" placeholder="••••••••" {...field} data-testid="input-password" />
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
