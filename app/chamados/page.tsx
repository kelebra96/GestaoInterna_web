import React from "react";
import SupportRequestForm from "@/components/SupportRequestForm";
import SupportRequestsList from "@/components/SupportRequestsList";

export const metadata = {
  title: "Chamados - IA Assistente",
};

export default function ChamadosPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Solicitações / Chamados</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 border rounded">
          <h2 className="font-medium mb-2">Novo chamado</h2>
          <SupportRequestForm />
        </div>

        <div className="p-4 border rounded">
          <SupportRequestsList />
        </div>
      </div>
    </div>
  );
}
