import { supabase } from "./supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimeEntry {
  id: string;
  entry_date: string;
  client: string;
  project: string;
  description: string | null;
  hours: number;
  rate: number;
  billable: boolean;
  invoice_id: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  contact: string | null;
  address: string | null;
  email: string | null;
  default_rate: number | null;
  notes: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  client_contact: string | null;
  client_address: string | null;
  period_start: string | null;
  period_end: string | null;
  issue_date: string;
  due_date: string | null;
  tax_rate: number;
  po_ref: string | null;
  notes: string | null;
  status: "draft" | "sent" | "paid" | "overdue" | "void";
  created_at: string;
}

export interface InvoiceSummary extends Invoice {
  subtotal: number;
  tax_amount: number;
  total: number;
  total_paid: number;
  balance_due: number;
}

export interface LineItem {
  id?: string;
  invoice_id?: string;
  description: string;
  project: string | null;
  hours: number | null;
  rate: number | null;
  amount: number;
  sort_order?: number;
}

export interface Payment {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  method: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

// ── Clients ───────────────────────────────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

export async function addClient(
  client: Omit<Client, "id" | "created_at">
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .insert(client)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateClient(
  id: string,
  updates: Partial<Omit<Client, "id" | "created_at">>
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

// ── Time Entries ──────────────────────────────────────────────────────────────

export async function getTimeEntries(opts?: {
  client?: string;
  unbilledOnly?: boolean;
  startDate?: string;
  endDate?: string;
  invoiceId?: string;
}): Promise<TimeEntry[]> {
  let q = supabase
    .from("time_entries")
    .select("*")
    .order("entry_date", { ascending: false });
  if (opts?.client) q = q.eq("client", opts.client);
  if (opts?.unbilledOnly) q = q.is("invoice_id", null);
  if (opts?.startDate) q = q.gte("entry_date", opts.startDate);
  if (opts?.endDate) q = q.lte("entry_date", opts.endDate);
  if (opts?.invoiceId) q = q.eq("invoice_id", opts.invoiceId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function addTimeEntry(
  entry: Omit<TimeEntry, "id" | "invoice_id" | "created_at">
): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from("time_entries")
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTimeEntry(
  id: string,
  updates: Partial<Omit<TimeEntry, "id" | "created_at">>
): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from("time_entries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  if (error) throw error;
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export async function getInvoices(status?: string): Promise<InvoiceSummary[]> {
  let q = supabase
    .from("invoice_summary")
    .select("*")
    .order("issue_date", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getInvoice(id: string): Promise<Invoice> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getInvoiceLineItems(invoiceId: string): Promise<LineItem[]> {
  const { data, error } = await supabase
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("sort_order");
  if (error) throw error;
  return data;
}

export async function createInvoice(params: {
  invoice_number: string;
  client_name: string;
  client_contact?: string;
  client_address?: string;
  period_start?: string;
  period_end?: string;
  issue_date: string;
  due_date?: string;
  tax_rate: number;
  po_ref?: string;
  notes?: string;
  line_items: Omit<LineItem, "id" | "invoice_id" | "sort_order">[];
  time_entry_ids?: string[];
}): Promise<Invoice> {
  const { line_items, time_entry_ids, ...invoiceData } = params;

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({ ...invoiceData, status: "draft" })
    .select()
    .single();
  if (invErr) throw invErr;

  const items = line_items.map((item, i) => ({
    ...item,
    invoice_id: invoice.id,
    sort_order: i,
  }));
  const { error: itemErr } = await supabase
    .from("invoice_line_items")
    .insert(items);
  if (itemErr) throw itemErr;

  if (time_entry_ids?.length) {
    const { error: linkErr } = await supabase
      .from("time_entries")
      .update({ invoice_id: invoice.id })
      .in("id", time_entry_ids);
    if (linkErr) throw linkErr;
  }

  return invoice;
}

export async function updateInvoice(
  id: string,
  params: {
    invoice_number?: string;
    client_name?: string;
    client_contact?: string | null;
    client_address?: string | null;
    period_start?: string | null;
    period_end?: string | null;
    issue_date?: string;
    due_date?: string | null;
    tax_rate?: number;
    po_ref?: string | null;
    notes?: string | null;
    line_items: Omit<LineItem, "id" | "invoice_id" | "sort_order">[];
    time_entry_ids?: string[];
    unlink_time_entry_ids?: string[];
  }
): Promise<Invoice> {
  const { line_items, time_entry_ids, unlink_time_entry_ids, ...invoiceData } = params;

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .update(invoiceData)
    .eq("id", id)
    .select()
    .single();
  if (invErr) throw invErr;

  const { error: delErr } = await supabase
    .from("invoice_line_items")
    .delete()
    .eq("invoice_id", id);
  if (delErr) throw delErr;

  const items = line_items.map((item, i) => ({
    ...item,
    invoice_id: id,
    sort_order: i,
  }));
  if (items.length) {
    const { error: itemErr } = await supabase
      .from("invoice_line_items")
      .insert(items);
    if (itemErr) throw itemErr;
  }

  if (unlink_time_entry_ids?.length) {
    const { error: unlinkErr } = await supabase
      .from("time_entries")
      .update({ invoice_id: null })
      .in("id", unlink_time_entry_ids);
    if (unlinkErr) throw unlinkErr;
  }

  if (time_entry_ids?.length) {
    const { error: linkErr } = await supabase
      .from("time_entries")
      .update({ invoice_id: id })
      .in("id", time_entry_ids);
    if (linkErr) throw linkErr;
  }

  return invoice;
}

export async function updateInvoiceStatus(
  id: string,
  status: Invoice["status"]
): Promise<void> {
  const { error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function voidInvoice(id: string): Promise<void> {
  await supabase
    .from("time_entries")
    .update({ invoice_id: null })
    .eq("invoice_id", id);
  await updateInvoiceStatus(id, "void");
}

export async function nextInvoiceNumber(): Promise<string> {
  const { data } = await supabase.from("invoices").select("invoice_number");
  const nums: number[] = [];
  for (const row of data ?? []) {
    const n = parseInt(row.invoice_number.split("-").at(-1) ?? "", 10);
    if (!isNaN(n)) nums.push(n);
  }
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `INV-${String(next).padStart(3, "0")}`;
}

// ── Payments ──────────────────────────────────────────────────────────────────

export async function getPayments(invoiceId?: string): Promise<Payment[]> {
  let q = supabase
    .from("payments")
    .select("*")
    .order("payment_date", { ascending: false });
  if (invoiceId) q = q.eq("invoice_id", invoiceId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function addPayment(payment: {
  invoice_id: string;
  payment_date: string;
  amount: number;
  method?: string;
  reference?: string;
  notes?: string;
}): Promise<Payment> {
  const { data, error } = await supabase
    .from("payments")
    .insert(payment)
    .select()
    .single();
  if (error) throw error;

  // Auto-mark paid if balance reaches zero
  const { data: summary } = await supabase
    .from("invoice_summary")
    .select("balance_due")
    .eq("id", payment.invoice_id)
    .single();
  if (summary && summary.balance_due <= 0) {
    await updateInvoiceStatus(payment.invoice_id, "paid");
  }

  return data;
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw error;
}
