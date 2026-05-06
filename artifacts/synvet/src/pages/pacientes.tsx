import { useState } from "react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { useListPets, getListPetsQueryKey } from "@workspace/api-client-react";
import { Search, Plus, Dog, Cat, User, Scale } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Pacientes() {
  const [search, setSearch] = useState("");
  const { data: pets, isLoading } = useListPets({ q: search || undefined });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-muted-foreground">Gerencie os animais da clínica.</p>
        </div>

        <Link href="/tutores">
          <Button variant="outline" data-testid="button-new-pet">
            <Plus className="w-4 h-4 mr-2" />
            Novo Paciente
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar pacientes..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-pets"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="space-y-2 pt-4 border-t">
                  <Skeleton className="h-3 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : pets && pets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pets.map((pet) => (
            <Link key={pet.id} href={`/pacientes/${pet.id}`} data-testid={`link-pet-${pet.id}`}>
              <Card className="h-full hover-elevate transition-all cursor-pointer border-border/50 bg-card/50 hover:bg-card">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        {pet.species === "Felina" ? <Cat className="h-6 w-6" /> : <Dog className="h-6 w-6" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg truncate" data-testid={`text-pet-name-${pet.id}`}>
                            {pet.name}
                          </h3>
                          {pet.sex === "male" && <span className="text-blue-500 font-bold leading-none">♂</span>}
                          {pet.sex === "female" && <span className="text-pink-500 font-bold leading-none">♀</span>}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {pet.species}{pet.breed ? ` • ${pet.breed}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {pet.neutered && (
                      <Badge variant="secondary" className="text-xs">Castrado</Badge>
                    )}
                    {pet.weightKg && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Scale className="w-3 h-3" />
                        {pet.weightKg} kg
                      </Badge>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground mt-4 pt-4 border-t border-border/50 flex items-center gap-2">
                    <User className="h-4 w-4 shrink-0" />
                    <span className="truncate">Tutor: {pet.tutorName}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg border-dashed bg-card/30">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Dog className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium mb-1">Nenhum paciente encontrado</h3>
          <p className="text-muted-foreground mb-4 max-w-sm">
            {search ? "Nenhum paciente corresponde à sua busca." : "Para adicionar um paciente, primeiro acesse a página de Tutores e adicione através do perfil do tutor."}
          </p>
          <Link href="/tutores">
            <Button variant="outline">
              Ir para Tutores
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
