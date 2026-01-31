import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Generate invoice PDF in POS (thermal receipt) or A4 format
 * @param {Object} options
 * @param {string} options.format - 'pos' or 'a4'
 * @param {Object} options.shop - { name, address, phone, gstin }
 * @param {Array} options.cart - [{ name, qty, price, discountPercent, gstEnabled, gstPercent }]
 * @param {Object} options.totals - { subtotal, totalDiscount, totalGst, grandTotal }
 * @param {string} options.invoiceId - Invoice number
 * @returns {jsPDF} - PDF document object
 */
export function generateInvoicePDF({
    format = "pos",
    shop = {},
    cart = [],
    totals = {},
    invoiceId = ""
}) {
    const isPOS = format === "pos";

    // POS: 58mm width thermal receipt, A4: standard
    const doc = isPOS
        ? new jsPDF({ unit: "mm", format: [58, 200] }) // 58mm wide, auto-height
        : new jsPDF({ unit: "mm", format: "a4" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = isPOS ? 2 : 15;
    let y = isPOS ? 5 : 20;

    const date = new Date();
    const dateStr = date.toLocaleDateString("en-GB");
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (isPOS) {
        // ===== POS THERMAL RECEIPT =====
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(shop.name || "Store", pageWidth / 2, y, { align: "center" });
        y += 4;

        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        if (shop.address) {
            doc.text(shop.address, pageWidth / 2, y, { align: "center" });
            y += 3;
        }
        if (shop.phone) {
            doc.text(`Ph: ${shop.phone}`, pageWidth / 2, y, { align: "center" });
            y += 3;
        }

        // Divider
        doc.setLineWidth(0.1);
        doc.line(margin, y, pageWidth - margin, y);
        y += 3;

        // Date & Invoice
        doc.setFontSize(6);
        doc.text(`Date: ${dateStr} ${timeStr}`, margin, y);
        y += 3;
        doc.text(`Invoice: #${invoiceId}`, margin, y);
        y += 4;

        // Divider
        doc.line(margin, y, pageWidth - margin, y);
        y += 3;

        // Items
        doc.setFontSize(6);
        cart.forEach((item) => {
            const lineTotal = (item.price * item.qty).toFixed(2);
            doc.text(item.name.substring(0, 18), margin, y);
            y += 3;
            doc.text(`  ${item.qty} x ₹${item.price} = ₹${lineTotal}`, margin, y);
            y += 4;
        });

        // Divider
        doc.line(margin, y, pageWidth - margin, y);
        y += 3;

        // Totals
        doc.text(`Subtotal: ₹${totals.subtotal?.toFixed(2) || "0.00"}`, margin, y);
        y += 3;

        if (totals.totalDiscount > 0) {
            doc.text(`Discount: -₹${totals.totalDiscount.toFixed(2)}`, margin, y);
            y += 3;
        }

        if (totals.totalGst > 0) {
            doc.text(`GST: ₹${totals.totalGst.toFixed(2)}`, margin, y);
            y += 3;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(`TOTAL: ₹${totals.grandTotal?.toFixed(2) || "0.00"}`, margin, y);
        y += 5;

        // Footer
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.line(margin, y, pageWidth - margin, y);
        y += 3;
        doc.text("Thank you for shopping!", pageWidth / 2, y, { align: "center" });
        y += 3;
        if (shop.gstin) {
            doc.text(`GSTIN: ${shop.gstin}`, pageWidth / 2, y, { align: "center" });
        }

    } else {
        // ===== A4 INVOICE =====
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(shop.name || "Store", margin, y);
        y += 8;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        if (shop.address) {
            doc.text(shop.address, margin, y);
            y += 5;
        }
        if (shop.phone) {
            doc.text(`Phone: ${shop.phone}`, margin, y);
            y += 5;
        }
        if (shop.gstin) {
            doc.text(`GSTIN: ${shop.gstin}`, margin, y);
            y += 5;
        }

        y += 5;

        // Invoice Meta (right aligned)
        doc.setFontSize(10);
        doc.text(`Invoice #: ${invoiceId}`, pageWidth - margin, 20, { align: "right" });
        doc.text(`Date: ${dateStr}`, pageWidth - margin, 26, { align: "right" });
        doc.text(`Time: ${timeStr}`, pageWidth - margin, 32, { align: "right" });

        y += 10;

        // Items Table
        const tableBody = cart.map((item) => [
            item.name,
            item.qty.toString(),
            `₹${item.price.toFixed(2)}`,
            `₹${(item.price * item.qty).toFixed(2)}`
        ]);

        autoTable(doc, {
            startY: y,
            head: [["Item", "Qty", "Price", "Total"]],
            body: tableBody,
            theme: "striped",
            headStyles: { fillColor: [50, 50, 50] },
            margin: { left: margin, right: margin },
            styles: { fontSize: 10 }
        });

        y = doc.lastAutoTable.finalY + 10;

        // Totals
        const totalsX = pageWidth - margin - 60;
        doc.setFontSize(10);
        doc.text("Subtotal:", totalsX, y);
        doc.text(`₹${totals.subtotal?.toFixed(2) || "0.00"}`, pageWidth - margin, y, { align: "right" });
        y += 6;

        if (totals.totalDiscount > 0) {
            doc.text("Discount:", totalsX, y);
            doc.text(`-₹${totals.totalDiscount.toFixed(2)}`, pageWidth - margin, y, { align: "right" });
            y += 6;
        }

        if (totals.totalGst > 0) {
            doc.text("GST:", totalsX, y);
            doc.text(`₹${totals.totalGst.toFixed(2)}`, pageWidth - margin, y, { align: "right" });
            y += 6;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Grand Total:", totalsX, y);
        doc.text(`₹${totals.grandTotal?.toFixed(2) || "0.00"}`, pageWidth - margin, y, { align: "right" });
        y += 15;

        // Footer
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text("Thank you for your business!", pageWidth / 2, y, { align: "center" });
    }

    return doc;
}

/**
 * Download the PDF
 * @param {jsPDF} doc 
 * @param {string} filename 
 */
export function downloadPDF(doc, filename = "invoice.pdf") {
    doc.save(filename);
}

/**
 * Get PDF as Blob for sharing
 * @param {jsPDF} doc 
 * @returns {Blob}
 */
export function getPDFBlob(doc) {
    return doc.output("blob");
}
