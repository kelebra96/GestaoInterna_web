"use client";
import React, { useState } from "react";

export default function SupportRequestForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro");
      setTitle("");
      setDescription("");
      window.location.reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao criar chamado";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div>
        <label className="block text-sm font-medium">Título</label>
        <input
          className="w-full border px-2 py-1 rounded"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Descrição</label>
        <textarea
          className="w-full border px-2 py-1 rounded"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div>
        <button
          className="bg-blue-600 text-white px-3 py-1 rounded"
          disabled={loading}>
          {loading ? "Enviando..." : "Criar chamado"}
        </button>
      </div>
    </form>
  );
}
