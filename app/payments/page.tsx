"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { getInvoices, getPayments, addPayment, deletePayment, type InvoiceSummary, type Payment } from "@/lib/db";

const today = () => new Date().toISOString().split("T")[0];

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [amount, setAmount] = useState("");
  const [payDate, setPayDate] = useState(today());
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [inv, pay] = await Promise.all([
        getInvoices(),
        getPayments(),
      ]);
      setInvoices(inv.filter((i) => i.status !== "void"));
      setPayments(pay);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const invoiceMap = Object.fromEntries(invoices.map((i) => [i.id, i]));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoice) { toast.error("Select an invoice."); return; }
    setSaving(true);
    try {
      await addPayment({
        invoice_id: selectedInvoice,
        payment_date: payDate,
        amount: parseFloat(amount),
        method: method || undefined,
        reference: reference || undefined,
        notes: notes || undefined,
      });
      toast.success("Payment recorded.");
      setShowAdd(false);
      setAmount(""); setMethod(""); setReference(""); setNotes("");
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this payment?")) return;
    try { await deletePayment(id); toast.success("Deleted."); load(); }
    catch (err: any) { toast.error(err.message); }
  }

  const totalReceived = payments.reduce((s, p) => s + p.amount, 0);
  const openInvoices = invoices.filter((i) => i.balance_due > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payments</h1>
        <Button onClick={() => setShowAdd(true)}>+ Record Payment</Button>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1">
              <Label>Invoice *</Label>
              <Select value={selectedInvoice} onValueChange={(v) => {
                if (!v) return;
                setSelectedInvoice(v as string);
                const inv = invoices.find((i) => i.id === v);
                if (inv) setAmount(String(inv.balance_due.toFixed(2)));
              }}>
                <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>
                  {openInvoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.client_name} (${Number(inv.balance_due).toFixed(2)} due)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount *</Label>
                <Input type="number" min={0.01} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Method</Label>
                <Select value={method} onValueChange={(v) => v && setMethod(v as string)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {["Check", "ACH", "Wire", "Credit Card", "Cash", "Other"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Reference # / Check #</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Record Payment"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-sm font-medium text-muted-foreground">Total Received</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4"><p className="text-2xl font-semibold">${totalReceived.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-sm font-medium text-muted-foreground">Open Invoices</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4"><p className="text-2xl font-semibold">{openInvoices.length}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="p-6 text-muted-foreground">Loading…</p> :
           payments.length === 0 ? <p className="p-6 text-muted-foreground">No payments recorded yet.</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => {
                  const inv = invoiceMap[p.invoice_id];
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{p.payment_date}</TableCell>
                      <TableCell className="font-mono text-sm">{inv?.invoice_number ?? "—"}</TableCell>
                      <TableCell>{inv?.client_name ?? "—"}</TableCell>
                      <TableCell>{p.method ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{p.reference ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">${Number(p.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(p.id)}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
