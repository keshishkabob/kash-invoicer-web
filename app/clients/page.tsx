"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getClients, addClient, updateClient, deleteClient, type Client } from "@/lib/db";

const emptyForm = () => ({
  name: "", contact: "", address: "", email: "", default_rate: "", notes: "",
});

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [editForm, setEditForm] = useState(emptyForm());

  async function load() {
    setLoading(true);
    try { setClients(await getClients()); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function clientToForm(c: Client) {
    return {
      name: c.name, contact: c.contact ?? "", address: c.address ?? "",
      email: c.email ?? "", default_rate: c.default_rate ? String(c.default_rate) : "", notes: c.notes ?? "",
    };
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addClient({
        name: form.name, contact: form.contact || null, address: form.address || null,
        email: form.email || null, default_rate: form.default_rate ? parseFloat(form.default_rate) : null,
        notes: form.notes || null,
      });
      toast.success("Client added.");
      setForm(emptyForm());
      setShowAdd(false);
      load();
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editClient) return;
    try {
      await updateClient(editClient.id, {
        name: editForm.name, contact: editForm.contact || null, address: editForm.address || null,
        email: editForm.email || null, default_rate: editForm.default_rate ? parseFloat(editForm.default_rate) : null,
        notes: editForm.notes || null,
      });
      toast.success("Client updated.");
      setEditClient(null);
      load();
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete client "${name}"?`)) return;
    try { await deleteClient(id); toast.success("Deleted."); load(); }
    catch (err: any) { toast.error(err.message); }
  }

  const ClientForm = ({ values, setValues, onSubmit, submitLabel }: {
    values: typeof form; setValues: (v: typeof form) => void;
    onSubmit: (e: React.FormEvent) => void; submitLabel: string;
  }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Client Name *</Label>
          <Input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} required />
        </div>
        <div className="space-y-1">
          <Label>Contact / Attn</Label>
          <Input value={values.contact} onChange={(e) => setValues({ ...values, contact: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Address</Label>
        <Input value={values.address} onChange={(e) => setValues({ ...values, address: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Email</Label>
          <Input type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Default Rate ($/hr)</Label>
          <Input type="number" min={0} step={5} value={values.default_rate} onChange={(e) => setValues({ ...values, default_rate: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Notes</Label>
        <Textarea value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} rows={3} />
      </div>
      <DialogFooter>
        <Button type="submit">{submitLabel}</Button>
      </DialogFooter>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <Button onClick={() => setShowAdd(true)}>+ Add Client</Button>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Add Client</DialogTitle></DialogHeader>
          <ClientForm values={form} setValues={setForm} onSubmit={handleAdd} submitLabel="Add Client" />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editClient} onOpenChange={(o) => !o && setEditClient(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
          <ClientForm values={editForm} setValues={setEditForm} onSubmit={handleEdit} submitLabel="Save Changes" />
        </DialogContent>
      </Dialog>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : clients.length === 0 ? (
        <p className="text-muted-foreground">No clients yet. Add one above.</p>
      ) : (
        <div className="grid gap-4">
          {clients.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2 pt-4 px-5">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    {c.contact && <p className="text-sm text-muted-foreground">{c.contact}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditClient(c); setEditForm(clientToForm(c)); }}>Edit</Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDelete(c.id, c.name)}>Delete</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-4 text-sm text-muted-foreground space-y-0.5">
                {c.address && <p>{c.address}</p>}
                {c.email && <p>{c.email}</p>}
                {c.default_rate && <p>Default rate: ${Number(c.default_rate).toFixed(2)}/hr</p>}
                {c.notes && <p className="mt-1 italic">{c.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
