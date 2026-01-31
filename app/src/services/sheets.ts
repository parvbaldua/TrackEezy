import { google } from 'googleapis';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export class GoogleSheetsService {
    private auth;
    private sheets;

    constructor(accessToken: string, refreshToken?: string) {
        // Initialize with keys to allow refresh
        this.auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        this.auth.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        });
        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    }

    static async getService() {
        const session = await getServerSession(authOptions);
        const accessToken = (session as any)?.accessToken;
        const refreshToken = (session as any)?.refreshToken;

        if (!accessToken) {
            console.warn("No access token found in session");
            return null;
        }
        return new GoogleSheetsService(accessToken, refreshToken);
    }

    /**
     * Reads all data from the first sheet (assuming it's Inventory)
     * Headers expected: Name, SKU, Qty, Price, Base Unit, Display Unit, Conversion Factor
     */
    async getInventory(spreadsheetId: string) {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'A2:G', // Reading 7 columns
            });
            return response.data.values || [];
        } catch (error) {
            console.error("Error fetching inventory:", error);
            throw error;
        }
    }

    /**
     * Append a new row to the sheet
     */
    async addStock(spreadsheetId: string, rowData: (string | number)[]) {
        try {
            await this.sheets.spreadsheets.values.append({
                spreadsheetId,
                range: 'A1',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [rowData],
                },
            });
            return true;
        } catch (error) {
            console.error("Error adding stock:", error);
            throw error;
        }
    }

    /**
     * Initialize a new sheet with Headers if empty
     * Updated for Unit System: Removed Category, Added Units
     */
    async initializeSheet(spreadsheetId: string) {
        try {
            // Check if headers exist in A1:G1
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'A1:G1',
            });

            const rows = response.data.values || [];

            // If first row is empty, write headers
            if (rows.length === 0) {
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: 'A1:G1',
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [['Product Name', 'SKU', 'Quantity', 'Price', 'Base Unit', 'Display Unit', 'Conversion Factor']]
                    }
                });
            }
        } catch (e) {
            console.error("Init sheet error", e);
        }
    }

    /**
     * Batch update stock for sold items
     * items: { name: string, qty: number }[] (qty is in DISPLAY UNIT)
     */
    async deductStock(spreadsheetId: string, soldItems: { name: string, qty: number }[]) {
        try {
            // 1. Fetch current data to find row indices and conversion factors
            // Columns: 0:Name, 1:SKU, 2:Qty, 3:Price, 4:Base, 5:Display, 6:Factor
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'A2:G',
            });

            const rows = response.data.values || [];
            const dataToUpdate: { range: string, values: [[number]] }[] = [];

            // 2. Map sold items to rows
            soldItems.forEach(item => {
                // Find row by Name (Column A)
                const rowIndex = rows.findIndex(row =>
                    row[0]?.toString().toLowerCase().trim() === item.name.toLowerCase().trim()
                );

                if (rowIndex !== -1) {
                    const row = rows[rowIndex];
                    const currentQty = parseFloat(row[2] || '0');
                    const conversionFactor = parseFloat(row[6] || '1'); // Default to 1 if missing

                    // Calculate deduction in Base Units
                    // Sold Qty (Display) * Factor = Deduction (Base)
                    const deductionBase = item.qty * conversionFactor;

                    const newQty = Math.max(0, currentQty - deductionBase);

                    // Row index is 0-based from the range start (A2), so actual sheet row is rowIndex + 2.
                    const sheetRow = rowIndex + 2;

                    dataToUpdate.push({
                        range: `C${sheetRow}`, // Updating Column C (Quantity - Base Unit)
                        values: [[newQty]] // Storing Base Unit Quantity
                    });
                }
            });

            if (dataToUpdate.length === 0) return { success: true, message: "No matching items found to update" };

            // 3. Batch Update
            await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                requestBody: {
                    valueInputOption: 'USER_ENTERED',
                    data: dataToUpdate
                }
            });

            return { success: true, updated: dataToUpdate.length };

        } catch (error) {
            console.error("Error deducting stock:", error);
            throw error;
        }
    }

    async updateItem(spreadsheetId: string, originalName: string, rowData: (string | number)[]) {
        try {
            // 1. Find the row index by original name
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'A:A', // Fetch Names only
            });

            const rows = response.data.values || [];
            // Match name (case-insensitive, trimmed)
            const rowIndex = rows.findIndex(r => r[0]?.toString().toLowerCase().trim() === originalName.toLowerCase().trim());

            if (rowIndex === -1) {
                return { success: false, error: "Item not found in sheet" };
            }

            // 2. Update the row
            const sheetRow = rowIndex + 1; // 1-based index (A:A includes header at match 0, so Row 1)

            await this.sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `A${sheetRow}:G${sheetRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [rowData]
                }
            });

            return { success: true };

        } catch (error) {
            console.error("Error updating item:", error);
            throw error;
        }
    }
}
