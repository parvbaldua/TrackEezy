import { NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/services/sheets';

export async function POST(req: Request) {
    try {
        const { sheetUrl, action, data } = await req.json();

        // extract ID from URL
        // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit...
        const matches = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!matches || !matches[1]) {
            return NextResponse.json({ error: "Invalid Sheet URL" }, { status: 400 });
        }
        const spreadsheetId = matches[1];

        const service = await GoogleSheetsService.getService();
        if (!service) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (action === 'FETCH') {
            const rows = await service.getInventory(spreadsheetId);
            return NextResponse.json({ success: true, rows });
        } else if (action === 'ADD') {
            await service.addStock(spreadsheetId, data); // data = [name, sku, qty, price, cat]
            return NextResponse.json({ success: true });
        } else if (action === 'UPDATE') {
            // Assuming 'data' for UPDATE contains { originalName: '...', ...otherFieldsToUpdate }
            const { originalName } = data; // Access originalName from the 'data' object
            if (!originalName) {
                return NextResponse.json({ success: false, error: "Original name required for update" }, { status: 400 });
            }
            // Pass spreadsheetId instead of sheetUrl, consistent with other service calls
            const result = await service.updateItem(spreadsheetId, originalName, data);
            return NextResponse.json(result);
        } else if (action === 'SELL') {
            // data should be array of { name, qty }
            const result = await service.deductStock(spreadsheetId, data);
            return NextResponse.json({ success: true, result });
        } else if (action === 'INIT') {
            await service.initializeSheet(spreadsheetId);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid Action" }, { status: 400 });

    } catch (error: any) {
        console.error("Sync API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
