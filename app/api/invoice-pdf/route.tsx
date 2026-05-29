import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { getInvoice, getInvoiceLineItems } from "@/lib/db";

Font.register({
  family: "Helvetica",
  fonts: [{ src: "Helvetica" }, { src: "Helvetica-Bold", fontWeight: "bold" }],
});

const NAVY = "#1F3864";
const MID = "#666";
const LIGHT = "#f5f7fa";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, padding: 40, color: "#222" },
  row: { flexDirection: "row" },
  col: { flex: 1 },
  company: { fontSize: 20, fontWeight: "bold", color: NAVY, marginBottom: 2 },
  small: { fontSize: 8, color: MID, marginBottom: 2 },
  invoiceTitle: { fontSize: 20, fontWeight: "bold", color: NAVY },
  label: { fontSize: 8, color: MID },
  value: { fontSize: 10, marginBottom: 2 },
  sectionTitle: { fontSize: 9, fontWeight: "bold", color: NAVY, marginBottom: 4, textTransform: "uppercase" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ddd", marginVertical: 10 },
  tableHeader: { flexDirection: "row", backgroundColor: NAVY, padding: "5 8", color: "#fff", fontSize: 8, fontWeight: "bold" },
  tableRow: { flexDirection: "row", padding: "5 8", borderBottomWidth: 1, borderBottomColor: "#eee" },
  tableRowAlt: { flexDirection: "row", padding: "5 8", backgroundColor: LIGHT, borderBottomWidth: 1, borderBottomColor: "#eee" },
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },
  totalsLabel: { width: 100, textAlign: "right", color: MID, fontSize: 9 },
  totalsValue: { width: 80, textAlign: "right", fontSize: 9 },
  grandTotal: { fontWeight: "bold", fontSize: 11, color: NAVY },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: MID, textAlign: "center" },
  billToBox: { backgroundColor: LIGHT, padding: 10, borderRadius: 4, marginBottom: 10 },
  statusBadge: { fontSize: 8, fontWeight: "bold", textTransform: "uppercase", color: "#fff", backgroundColor: NAVY, padding: "2 6", borderRadius: 3 },
});

function fmt(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new NextResponse("Missing id", { status: 400 });

  const [inv, items] = await Promise.all([getInvoice(id), getInvoiceLineItems(id)]);

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const taxAmount = subtotal * inv.tax_rate;
  const total = subtotal + taxAmount;

  const pdf = await renderToBuffer(
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={[s.row, { marginBottom: 16 }]}>
          <View style={s.col}>
            <Text style={s.company}>Kash DataWorks</Text>
            <Text style={s.small}>kashdataworks.com</Text>
            <Text style={s.small}>chris@kashdataworks.com</Text>
            <Text style={s.small}>4918 Stone Mill Rd, Mountain Brook, AL 35223</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            <Text style={s.small}>#{inv.invoice_number}</Text>
            <Text style={s.small}>Date: {inv.issue_date}</Text>
            <Text style={s.small}>Due: {inv.due_date ?? "Net 30"}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Bill To */}
        <View style={[s.row, { marginVertical: 10 }]}>
          <View style={[s.col, s.billToBox]}>
            <Text style={s.sectionTitle}>Bill To</Text>
            <Text style={s.value}>{inv.client_name}</Text>
            {inv.client_contact && <Text style={s.small}>{inv.client_contact}</Text>}
            {inv.client_address && <Text style={s.small}>{inv.client_address}</Text>}
          </View>
          <View style={{ width: 20 }} />
          <View style={[s.col, s.billToBox]}>
            {inv.period_start && inv.period_end && (
              <>
                <Text style={s.sectionTitle}>Period</Text>
                <Text style={s.value}>{inv.period_start} — {inv.period_end}</Text>
              </>
            )}
            {inv.po_ref && <><Text style={s.label}>PO / Reference</Text><Text style={s.value}>{inv.po_ref}</Text></>}
          </View>
        </View>

        {/* Line Items */}
        <View style={s.tableHeader}>
          <Text style={{ flex: 3 }}>Description</Text>
          <Text style={{ flex: 1 }}>Project</Text>
          <Text style={{ width: 40, textAlign: "right" }}>Hrs</Text>
          <Text style={{ width: 55, textAlign: "right" }}>Rate</Text>
          <Text style={{ width: 65, textAlign: "right" }}>Amount</Text>
        </View>
        {items.map((item, i) => (
          <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
            <Text style={{ flex: 3 }}>{item.description}</Text>
            <Text style={{ flex: 1, color: MID }}>{item.project ?? ""}</Text>
            <Text style={{ width: 40, textAlign: "right" }}>{item.hours ?? ""}</Text>
            <Text style={{ width: 55, textAlign: "right" }}>{item.rate ? fmt(item.rate) : ""}</Text>
            <Text style={{ width: 65, textAlign: "right" }}>{fmt(item.amount)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={{ marginTop: 8 }}>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Subtotal</Text>
            <Text style={s.totalsValue}>{fmt(subtotal)}</Text>
          </View>
          {inv.tax_rate > 0 && (
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Tax ({(inv.tax_rate * 100).toFixed(1)}%)</Text>
              <Text style={s.totalsValue}>{fmt(taxAmount)}</Text>
            </View>
          )}
          <View style={[s.totalsRow, { marginTop: 4 }]}>
            <Text style={[s.totalsLabel, s.grandTotal]}>Total Due</Text>
            <Text style={[s.totalsValue, s.grandTotal]}>{fmt(total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {inv.notes && (
          <View style={{ marginTop: 16 }}>
            <View style={s.divider} />
            <Text style={s.sectionTitle}>Notes / Payment Instructions</Text>
            <Text style={{ fontSize: 9, color: MID }}>{inv.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={s.footer}>
          Questions? Email: chris@kashdataworks.com
        </Text>
      </Page>
    </Document>
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${inv.invoice_number}.pdf"`,
    },
  });
}
