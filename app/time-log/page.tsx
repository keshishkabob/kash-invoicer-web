"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getTimeEntries, addTimeEntry, updateTimeEntry, deleteTimeEntry, getClients, type TimeEntry, type Client } from "@/lib/db";

const today = () => new Date().toISOString().split("T")[0];

const emptyForm = () => ({
  entry_date: today(),
  client: "",
  project: "",
  description: "",
  hours: "",
  rate: "150",
  billable: true,
});

export default function TimeLogPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [showAdd, setShowAdd] = useState(false);

  // Filters
  const [filterClient, setFilterClient] = useState("all");
  const [filterStart, setFilterStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split("T")[0];
  });
  const [filterEnd, setFilterEnd] = useState(today());
  const [filterUnbilled, setFilterUnbilled] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [e, c] = await Promise.all([
        getTimeEntries({
          client: filterClient === "all" ? undefined : filterClient,
          unbilledOnly: filterUnbilled,
          startDate: filterStart,
          endDate: filterEnd,
        }),
        getClients(),
      ]);
      setEntries(e);
      setClients(c);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterClient, filterStart, filterEnd, filterUnbilled]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addTimeEntry({
        entry_date: form.entry_date,
        client: form.client,
        project: form.project,
        description: form.description || null,
        hours: parseFloat(form.hours),
        rate: parseFloat(form.rate),
        billable: form.billable,
      } as any);
      toast.success("Entry saved.");
      setForm(emptyForm());
      setShowAdd(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editEntry) return;
    try {
      await updateTimeEntry(editEntry.id, {
        entry_date: editForm.entry_date,
        client: editForm.client,
        project: editForm.project,
        description: editForm.description || null,
        hours: parseFloat(editForm.hours),
        rate: parseFloat(editForm.rate),
        billable: editForm.billable,
      });
      toast.success("Entry updated.");
      setEditEntry(null);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    try {
      await deleteTimeEntry(id);
      toast.success("Deleted.");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function openEdit(entry: TimeEntry) {
    setEditEntry(entry);
    setEditForm({
      entry_date: entry.entry_date,
      client: entry.client,
      project: entry.project,
      description: entry.description ?? "",
      hours: String(entry.hours),
      rate: String(entry.rate),
      billable: entry.billable,
    });
  }

  const clientNames = clients.map((c) => c.name);
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const billableHours = entries.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0);
  const billableAmount = entries.filter((e) => e.billable).reduce((s, e) => s + e.hours * e.rate, 0);
  const unbilledAmount = entries.filter((e) => e.billable && !e.invoice_id).reduce((s, e) => s + e.hours * e.rate, 0);

  const EntryForm = ({ values, setValues, onSubmit, submitLabel }: {
    values: typeof form;
    setValues: (v: typeof form) => void;
    onSubmit: (e: React.FormEvent) => void;
    submitLabel: string;
  }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>Date</Label>
          <Input type="date" value={values.entry_date} onChange={(e) => setValues({ ...values, entry_date: e.target.value })} required />
        </div>
        <div className="space-y-1">
          <Label>Client</Label>
          {clientNames.length > 0 ? (
            <Select value={values.client} onValueChange={(v) => {
              if (!v) return;
              const c = clients.find((c) => c.name === v);
              setValues({ ...values, client: v as string, rate: c?.default_rate ? String(c.default_rate) : values.rate });
            }}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clientNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input value={values.client} onChange={(e) => setValues({ ...values, client: e.target.value })} placeholder="Client name" required />
          )}
        </div>
        <div className="space-y-1">
          <Label>Project</Label>
          <Input value={values.project} onChange={(e) => setValues({ ...values, project: e.target.value })} placeholder="Project name" required />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-2 space-y-1">
          <Label>Notes</Label>
          <Input value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} placeholder="Task description" />
        </div>
        <div className="space-y-1">
          <Label>Hours</Label>
          <Input type="number" min={0} step={0.25} value={values.hours} onChange={(e) => setValues({ ...values, hours: e.target.value })} required />
        </div>
        <div className="space-y-1">
          <Label>Rate ($/hr)</Label>
          <Input type="number" min={0} step={5} value={values.rate} onChange={(e) => setValues({ ...values, rate: e.target.value })} required />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="billable" checked={values.billable} onCheckedChange={(v) => setValues({ ...values, billable: !!v })} />
        <Label htmlFor="billable">Billable</Label>
      </div>
      <DialogFooter>
        <Button type="submit">{submitLabel}</Button>
      </DialogFooter>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Time Log</h1>
        <Button onClick={() => setShowAdd(true)}>+ Add Entry</Button>
      </div>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Add Time Entry</DialogTitle></DialogHeader>
          <EntryForm values={form} setValues={setForm} onSubmit={handleAdd} submitLabel="Save Entry" />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editEntry} onOpenChange={(o) => !o && setEditEntry(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit Entry</DialogTitle></DialogHeader>
          <EntryForm values={editForm} setValues={setEditForm} onSubmit={handleEdit} submitLabel="Save Changes" />
        </DialogContent>
      </Dialog>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Hours", value: totalHours.toFixed(2) },
          { label: "Billable Hours", value: billableHours.toFixed(2) },
          { label: "Billable Amount", value: `$${billableAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
          { label: "Unbilled Amount", value: `$${unbilledAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4"><p className="text-2xl font-semibold">{value}</p></CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label>Client</Label>
              <Select value={filterClient} onValueChange={(v) => setFilterClient((v as string) ?? "all")}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clientNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} className="w-36" />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} className="w-36" />
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <Checkbox id="unbilled" checked={filterUnbilled} onCheckedChange={(v) => setFilterUnbilled(!!v)} />
              <Label htmlFor="unbilled">Unbilled only</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-muted-foreground">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="p-6 text-muted-foreground">No entries found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{e.entry_date}</TableCell>
                    <TableCell>{e.client}</TableCell>
                    <TableCell>{e.project}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{e.description}</TableCell>
                    <TableCell className="text-right">{Number(e.hours).toFixed(2)}</TableCell>
                    <TableCell className="text-right">${Number(e.rate).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {e.billable ? `$${(e.hours * e.rate).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>
                      {e.invoice_id ? (
                        <Badge variant="secondary">Invoiced</Badge>
                      ) : e.billable ? (
                        <Badge variant="outline">Unbilled</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Non-billable</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(e)}>Edit</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(e.id)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
