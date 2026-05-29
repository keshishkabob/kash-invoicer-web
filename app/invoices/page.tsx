"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getInvoices, getInvoice, getInvoiceLineItems, getTimeEntries, getClients,
  createInvoice, updateInvoice, updateInvoiceStatus, voidInvoice,
  nextInvoiceNumber, type InvoiceSummary, type TimeEntry, type Client,
} from "@/lib/db";

const today = () => new Date().toISOString().split("T")[0];
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; };

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary", sent: "default", paid: "default",
  overdue: "destructive", void: "outline",
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_COLORS[status] as any}>{status}</Badge>;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [unbilled, setUnbilled] = useState<TimeEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("list");

  // Create form state
  const [invNumber, setInvNumber] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0];
  });
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [periodStart, setPeriodStart] = useState(firstOfMonth());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [taxRate, setTaxRate] = useState("0");
  const [poRef, setPoRef] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [manualRows, setManualRows] = useState<
    { description: string; project: string; hours: string; rate: string; amount: string; time_entry_id?: string }[]
  >([
    { description: "", project: "", hours: "", rate: "", amount: "" },
    { description: "", project: "", hours: "", rate: "", amount: "" },
    { description: "", project: "", hours: "", rate: "", amount: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceSummary | null>(null);
  const [unlinkEntryIds, setUnlinkEntryIds] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [inv, ub, cl, num] = await Promise.all([
        getInvoices(statusFilter === "all" ? undefined : statusFilter),
        getTimeEntries({ unbilledOnly: true }),
        getClients(),
        nextInvoiceNumber(),
      ]);
      setInvoices(inv);
      setUnbilled(ub);
      setClients(cl);
      setInvNumber(num);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]);

  function pickClient(name: string) {
    setClientName(name);
    const c = clients.find((c) => c.name === name);
    if (c) {
      setClientContact(c.contact ?? "");
      setClientAddress(c.address ?? "");
    }
  }

  function toggleEntry(id: string) {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedTotal = Array.from(selectedEntries).reduce((s, id) => {
    const e = unbilled.find((e) => e.id === id);
    return s + (e ? e.hours * e.rate : 0);
  }, 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName) { toast.error("Client name is required."); return; }

    const lineItems: any[] = [];
    const entryIds = Array.from(selectedEntries);

    for (const id of entryIds) {
      const entry = unbilled.find((e) => e.id === id)!;
      lineItems.push({
        description: entry.description || entry.project,
        project: entry.project,
        hours: entry.hours,
        rate: entry.rate,
        amount: entry.hours * entry.rate,
      });
    }

    for (const row of manualRows) {
      if (row.description.trim()) {
        const amt = parseFloat(row.amount) || (parseFloat(row.hours) || 0) * (parseFloat(row.rate) || 0);
        lineItems.push({
          description: row.description,
          project: row.project || null,
          hours: parseFloat(row.hours) || null,
          rate: parseFloat(row.rate) || null,
          amount: amt,
        });
      }
    }

    if (!lineItems.length) { toast.error("Add at least one line item."); return; }

    setSaving(true);
    try {
      if (editingInvoice) {
        await updateInvoice(editingInvoice.id, {
          invoice_number: invNumber,
          client_name: clientName,
          client_contact: clientContact || null,
          client_address: clientAddress || null,
          period_start: periodStart || null,
          period_end: periodEnd || null,
          issue_date: issueDate,
          due_date: dueDate || null,
          tax_rate: parseFloat(taxRate) / 100,
          po_ref: poRef || null,
          notes: notes || null,
          line_items: lineItems,
          time_entry_ids: entryIds.length ? entryIds : undefined,
          unlink_time_entry_ids: unlinkEntryIds.length ? unlinkEntryIds : undefined,
        });
        toast.success(`Invoice ${invNumber} updated.`);
        setEditingInvoice(null);
        setUnlinkEntryIds([]);
      } else {
        const inv = await createInvoice({
          invoice_number: invNumber,
          client_name: clientName,
          client_contact: clientContact || undefined,
          client_address: clientAddress || undefined,
          period_start: periodStart || undefined,
          period_end: periodEnd || undefined,
          issue_date: issueDate,
          due_date: dueDate || undefined,
          tax_rate: parseFloat(taxRate) / 100,
          po_ref: poRef || undefined,
          notes: notes || undefined,
          line_items: lineItems,
          time_entry_ids: entryIds,
        });
        toast.success(`Invoice ${inv.invoice_number} created!`);
        setSelectedEntries(new Set());
      }
      setActiveTab("list");
      setManualRows([
        { description: "", project: "", hours: "", rate: "", amount: "" },
        { description: "", project: "", hours: "", rate: "", amount: "" },
        { description: "", project: "", hours: "", rate: "", amount: "" },
      ]);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      if (status === "void") { await voidInvoice(id); }
      else { await updateInvoiceStatus(id, status as any); }
      toast.success(`Status updated to "${status}".`);
      load();
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleEdit(inv: InvoiceSummary) {
    try {
      const [full, items, linked] = await Promise.all([
        getInvoice(inv.id),
        getInvoiceLineItems(inv.id),
        getTimeEntries({ invoiceId: inv.id }),
      ]);
      setEditingInvoice(inv);
      setInvNumber(full.invoice_number);
      setIssueDate(full.issue_date);
      setDueDate(full.due_date ?? "");
      setClientName(full.client_name);
      setClientContact(full.client_contact ?? "");
      setClientAddress(full.client_address ?? "");
      setPeriodStart(full.period_start ?? "");
      setPeriodEnd(full.period_end ?? "");
      setTaxRate(String(Number((full.tax_rate * 100).toFixed(4))));
      setPoRef(full.po_ref ?? "");
      setNotes(full.notes ?? "");
      setSelectedEntries(new Set());
      setUnlinkEntryIds([]);

      // Tag each line item row with the time entry it came from (matched by description+hours+rate)
      const unmatched = [...linked];
      const rows = items.map((item) => {
        const idx = unmatched.findIndex(
          (t) => (t.description || t.project) === item.description &&
                 Number(t.hours) === Number(item.hours) &&
                 Number(t.rate) === Number(item.rate)
        );
        const time_entry_id = idx >= 0 ? unmatched.splice(idx, 1)[0].id : undefined;
        return {
          description: item.description,
          project: item.project ?? "",
          hours: item.hours?.toString() ?? "",
          rate: item.rate?.toString() ?? "",
          amount: item.amount.toString(),
          time_entry_id,
        };
      });
      setManualRows(rows.length ? rows : [{ description: "", project: "", hours: "", rate: "", amount: "" }]);
      setActiveTab("create");
    } catch (err: any) { toast.error(err.message); }
  }

  function cancelEdit() {
    setEditingInvoice(null);
    setSelectedEntries(new Set());
    setUnlinkEntryIds([]);
    setManualRows([
      { description: "", project: "", hours: "", rate: "", amount: "" },
      { description: "", project: "", hours: "", rate: "", amount: "" },
      { description: "", project: "", hours: "", rate: "", amount: "" },
    ]);
  }

  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.total_paid, 0);
  const totalDue = invoices.reduce((s, i) => s + i.balance_due, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Invoices</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list" onClick={() => { if (editingInvoice) cancelEdit(); }}>All Invoices</TabsTrigger>
          <TabsTrigger value="create">{editingInvoice ? `Edit ${editingInvoice.invoice_number}` : "Create Invoice"}</TabsTrigger>
        </TabsList>

        {/* ── All Invoices ── */}
        <TabsContent value="list" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Invoiced", value: `$${totalInvoiced.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
              { label: "Total Paid", value: `$${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
              { label: "Balance Due", value: `$${totalDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
            ].map(({ label, value }) => (
              <Card key={label}>
                <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4"><p className="text-2xl font-semibold">{value}</p></CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["all", "draft", "sent", "paid", "overdue", "void"].map((s) => (
                  <SelectItem key={s} value={s}>{s === "all" ? "All" : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? <p className="p-6 text-muted-foreground">Loading…</p> :
               invoices.length === 0 ? <p className="p-6 text-muted-foreground">No invoices found.</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                        <TableCell>{inv.client_name}</TableCell>
                        <TableCell>{inv.issue_date}</TableCell>
                        <TableCell>{inv.due_date ?? "—"}</TableCell>
                        <TableCell><StatusBadge status={inv.status} /></TableCell>
                        <TableCell className="text-right">${Number(inv.total).toFixed(2)}</TableCell>
                        <TableCell className="text-right">${Number(inv.total_paid).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">${Number(inv.balance_due).toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2 justify-end items-center">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(inv)}>Edit</Button>
                            <a href={`/api/invoice-pdf?id=${inv.id}`} target="_blank">
                              <Button size="sm" variant="outline">PDF</Button>
                            </a>
                            <Select onValueChange={(v) => v && handleStatusChange(inv.id, v as string)}>
                              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Status…" /></SelectTrigger>
                              <SelectContent>
                                {["draft", "sent", "paid", "overdue", "void"].map((s) => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Create Invoice ── */}
        <TabsContent value="create" className="mt-4">
          <form onSubmit={handleCreate} className="space-y-6 max-w-4xl">

            {/* Unbilled entries */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{editingInvoice ? "Add Unbilled Time Entries" : "Unbilled Time Entries"}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {unbilled.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No unbilled entries.</p>
                ) : (
                  <>
                    {unbilled.map((e) => {
                      const amt = e.hours * e.rate;
                      return (
                        <div key={e.id} className="flex items-center gap-3 py-1">
                          <Checkbox
                            id={`e_${e.id}`}
                            checked={selectedEntries.has(e.id)}
                            onCheckedChange={() => toggleEntry(e.id)}
                          />
                          <label htmlFor={`e_${e.id}`} className="text-sm cursor-pointer flex-1">
                            <span className="font-medium">{e.client}</span>
                            {" · "}{e.entry_date}{" · "}{e.project}
                            {e.description && <span className="text-muted-foreground"> · {e.description}</span>}
                            {" · "}{e.hours}h @ ${Number(e.rate).toFixed(2)}/hr
                            {" = "}<span className="font-medium">${amt.toFixed(2)}</span>
                          </label>
                        </div>
                      );
                    })}
                    {selectedEntries.size > 0 && (
                      <p className="text-sm text-muted-foreground pt-1">
                        Selected: {selectedEntries.size} entries · ${selectedTotal.toFixed(2)}
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Invoice details */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Invoice Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Invoice #</Label>
                    <Input value={invNumber} onChange={(e) => setInvNumber(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Issue Date</Label>
                    <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Due Date</Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Client</Label>
                    {clients.length > 0 ? (
                      <Select value={clientName} onValueChange={(v) => v && pickClient(v as string)}>
                        <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Contact / Attn</Label>
                    <Input value={clientContact} onChange={(e) => setClientContact(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Client Address</Label>
                  <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Period Start</Label>
                    <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Period End</Label>
                    <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Tax Rate (%)</Label>
                    <Input type="number" min={0} max={100} step={0.5} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>PO / Reference #</Label>
                  <Input value={poRef} onChange={(e) => setPoRef(e.target.value)} placeholder="Optional" />
                </div>
                <div className="space-y-1">
                  <Label>Notes / Payment Instructions</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                </div>
              </CardContent>
            </Card>

            {/* Line items */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{editingInvoice ? "Line Items" : "Manual Line Items (optional)"}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {manualRows.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-2 items-center">
                    <Input placeholder="Description" value={row.description}
                      onChange={(e) => { const r = [...manualRows]; r[i] = { ...r[i], description: e.target.value }; setManualRows(r); }} />
                    <Input placeholder="Project" value={row.project}
                      onChange={(e) => { const r = [...manualRows]; r[i] = { ...r[i], project: e.target.value }; setManualRows(r); }} />
                    <Input className="w-24" type="number" placeholder="Hours" value={row.hours}
                      onChange={(e) => { const r = [...manualRows]; r[i] = { ...r[i], hours: e.target.value }; setManualRows(r); }} />
                    <Input className="w-28" type="number" placeholder="Amount $" value={row.amount}
                      onChange={(e) => { const r = [...manualRows]; r[i] = { ...r[i], amount: e.target.value }; setManualRows(r); }} />
                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive px-2"
                      onClick={() => {
                        if (row.time_entry_id) setUnlinkEntryIds((prev) => [...prev, row.time_entry_id!]);
                        setManualRows(manualRows.filter((_, j) => j !== i));
                      }}>✕</Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setManualRows([...manualRows, { description: "", project: "", hours: "", rate: "", amount: "" }])}>
                  + Add row
                </Button>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Saving…" : editingInvoice ? "Save Changes" : "Save Invoice"}
              </Button>
              {editingInvoice && (
                <Button type="button" variant="outline" onClick={() => { cancelEdit(); setActiveTab("list"); }}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
