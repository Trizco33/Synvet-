import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { createLead } from "@workspace/api-client-react";
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
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  name: z.string().min(2, "Informe seu nome"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().max(40).optional().or(z.literal("")),
  clinicName: z.string().max(160).optional().or(z.literal("")),
  role: z.string().max(80).optional().or(z.literal("")),
  message: z.string().max(1000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

export function LeadForm({ source = "landing-cta" }: { source?: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", clinicName: "", role: "", message: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      await createLead({
        name: values.name,
        email: values.email,
        phone: values.phone || null,
        clinicName: values.clinicName || null,
        role: values.role || null,
        message: values.message || null,
        source,
      });
      setSubmitted(true);
      form.reset();
      toast.success("Solicitação recebida", {
        description: "Em breve nossa equipe entra em contato.",
      });
    } catch (err) {
      const msg =
        err && typeof err === "object" && "data" in err && (err as { data?: { error?: string } }).data?.error
          ? (err as { data: { error: string } }).data.error
          : "Não foi possível enviar agora. Tente novamente em instantes.";
      toast.error("Falha ao enviar", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
        <h3 className="text-xl font-semibold text-white mb-1">Recebemos sua solicitação</h3>
        <p className="text-sm text-white/60 max-w-sm mx-auto">
          Em até 1 dia útil nossa equipe entra em contato para liberar o acesso e personalizar a sua experiência.
        </p>
        <Button
          variant="outline"
          className="mt-5 border-white/10 text-white/80 hover:bg-white/5"
          onClick={() => setSubmitted(false)}
        >
          Enviar nova solicitação
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white/80">Nome completo</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Dr. Camila Rocha"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="lead-name"
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
                <FormLabel className="text-white/80">E-mail profissional</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    placeholder="voce@clinica.com"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="lead-email"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="clinicName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white/80">Nome da clínica</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Clínica Felis"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white/80">WhatsApp</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="(11) 99999-9999"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/80">Conte sobre sua clínica (opcional)</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={3}
                  placeholder="Quantos veterinários, principal sistema usado hoje, o que mais te incomoda..."
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 text-base font-medium bg-gradient-to-r from-[#7A5CFF] to-[#5B8CFF] text-white hover:opacity-95 shadow-[0_0_32px_-8px_rgba(122,92,255,0.7)]"
          data-testid="lead-submit"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...
            </>
          ) : (
            "Solicitar acesso ao Synvet"
          )}
        </Button>
        <p className="text-xs text-white/40 text-center">
          Sem cartão de crédito. Resposta em até 1 dia útil.
        </p>
      </form>
    </Form>
  );
}
