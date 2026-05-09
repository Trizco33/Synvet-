import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { signupUser } from "@workspace/api-client-react";
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
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import logoUrl from "@assets/synvet-logo.png";

const schema = z
  .object({
    name: z.string().min(2, "Informe seu nome completo"),
    clinicName: z.string().min(2, "Informe o nome da clínica"),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "Senha precisa de pelo menos 6 caracteres"),
    passwordConfirm: z.string().min(6, "Confirme a senha"),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "As senhas não coincidem",
    path: ["passwordConfirm"],
  });

type FormValues = z.infer<typeof schema>;

const TRIAL_PERKS = [
  "14 dias grátis com acesso completo",
  "Sem cartão de crédito",
  "Migração assistida dos dados existentes",
  "Cancele quando quiser",
];

function readQueryParam(name: string): string {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  return url.searchParams.get(name) ?? "";
}

export default function Signup() {
  const [, setLocation] = useLocation();
  const { signInWithPassword } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      clinicName: "",
      email: "",
      password: "",
      passwordConfirm: "",
    },
  });

  useEffect(() => {
    const presets: Partial<FormValues> = {
      name: readQueryParam("name"),
      clinicName: readQueryParam("clinic"),
      email: readQueryParam("email"),
    };
    Object.entries(presets).forEach(([k, v]) => {
      if (v) form.setValue(k as keyof FormValues, v);
    });
  }, [form]);

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      await signupUser({
        email: values.email,
        password: values.password,
        name: values.name,
        clinicName: values.clinicName,
      });
      const { error } = await signInWithPassword(values.email, values.password);
      if (error) {
        toast.error("Conta criada, mas falhou ao entrar", { description: error });
        setLocation("/login");
      } else {
        toast.success("Bem-vindo à Synvet — seu trial começou.");
        setLocation("/app");
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "data" in err && (err as { data?: { error?: string } }).data?.error
          ? (err as { data: { error: string } }).data.error
          : "Não foi possível criar a conta. Tente novamente.";
      toast.error("Erro ao criar conta", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06070d] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(122,92,255,0.18),transparent_60%)]" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-10 md:py-16 grid lg:grid-cols-[1fr_440px] gap-12 items-center">
        <div className="hidden lg:block">
          <Link href="/">
            <img src={logoUrl} alt="Synvet" className="h-9 mb-10 cursor-pointer" />
          </Link>
          <h1 className="text-4xl xl:text-5xl font-semibold leading-tight">
            Comece grátis. <br />
            <span className="bg-gradient-to-r from-[#7A5CFF] to-[#5B8CFF] bg-clip-text text-transparent">
              Sua clínica em outro nível em 14 dias.
            </span>
          </h1>
          <p className="mt-5 text-white/60 max-w-md leading-relaxed">
            Acesso completo a prontuários inteligentes, IA assistiva, agenda integrada
            e Comunicação WhatsApp — sem cartão de crédito.
          </p>
          <ul className="mt-8 space-y-3">
            {TRIAL_PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-white/80">
                <Check className="w-4 h-4 mt-0.5 text-[#B6A6FF] shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <Card className="bg-[#0b0d16]/90 border-white/10 backdrop-blur">
          <CardHeader className="space-y-2">
            <Link href="/" className="lg:hidden">
              <img src={logoUrl} alt="Synvet" className="h-8 mb-2 cursor-pointer" />
            </Link>
            <h2 className="text-2xl font-semibold text-white">Crie sua conta</h2>
            <CardDescription className="text-white/60">
              14 dias grátis. Sem cartão. Cancele quando quiser.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/80">Seu nome</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Dra. Camila Rocha"
                          className="bg-white/5 border-white/10 text-white"
                          data-testid="signup-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clinicName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/80">Nome da clínica</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Clínica Vet Aurora"
                          className="bg-white/5 border-white/10 text-white"
                          data-testid="signup-clinic"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/80">E-mail</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="voce@clinica.com"
                          className="bg-white/5 border-white/10 text-white"
                          data-testid="signup-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/80">Senha</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            className="bg-white/5 border-white/10 text-white"
                            data-testid="signup-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="passwordConfirm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/80">Confirmar</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            className="bg-white/5 border-white/10 text-white"
                            data-testid="signup-password-confirm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-gradient-to-r from-[#7A5CFF] to-[#5B8CFF] hover:opacity-95 text-white"
                  data-testid="signup-submit"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando…
                    </>
                  ) : (
                    "Começar trial grátis"
                  )}
                </Button>
                <p className="text-center text-xs text-white/50">
                  Já tem conta?{" "}
                  <Link href="/login" className="text-[#B6A6FF] hover:underline">
                    Entrar
                  </Link>
                </p>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
