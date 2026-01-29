
const BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

export const GoogleSheetsService = {
    /**
     * Reads all data from the first sheet (assuming it's Inventory)
     * Headers expected: Name, SKU, Qty, Price, Category
     */
    async getInventory(token, spreadsheetId) {
        try {
            console.log("Fetching inventory...", { spreadsheetId, token: token?.slice(0, 10) + "..." });
            const url = `${BASE_URL}/${spreadsheetId}/values/A2:E`;
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error("Sheets API Error:", response.status, errText);
                if (response.status === 401) {
                    throw new Error("UNAUTHORIZED");
                }
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            console.log("Inventory Data Received:", data.values?.length || 0, "rows");
            if (data.error) throw new Error(data.error.message);
            return data.values || [];
        } catch (error) {
            console.error("Error fetching inventory:", error);
            throw error;
        }
    },

    /**
     * Append a new row to the sheet
     */
    async addStock(token, spreadsheetId, rowData) {
        try {
            const url = `${BASE_URL}/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    values: [rowData],
                }),
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            return true;
        } catch (error) {
            console.error("Error adding stock:", error);
            throw error;
        }
    },

    /**
     * Initialize a new sheet with Headers if empty
     */
    async initializeSheet(token, spreadsheetId) {
        try {
            // Check if headers exist in A1:E1
            const checkUrl = `${BASE_URL}/${spreadsheetId}/values/A1:E1`;
            const checkRes = await fetch(checkUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const checkData = await checkRes.json();
            const rows = checkData.values || [];

            // If first row is empty, write headers
            if (rows.length === 0) {
                const updateUrl = `${BASE_URL}/${spreadsheetId}/values/A1:E1?valueInputOption=USER_ENTERED`;
                await fetch(updateUrl, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        values: [["Product Name", "SKU", "Quantity", "Price", "Category"]],
                    }),
                });
            }
        } catch (e) {
            console.error("Init sheet error", e);
        }
    },

    /**
     * Update an item's details
     * Finds the row by originalName and updates all columns
     */
    async updateItem(token, spreadsheetId, originalName, itemData) {
        try {
            // 1. Fetch current data to find row index
            const readUrl = `${BASE_URL}/${spreadsheetId}/values/A:A`; // Read only names (Column A)
            const readRes = await fetch(readUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const readData = await readRes.json();
            const rows = readData.values || [];

            // 2. Find row index
            const rowIndex = rows.findIndex(
                (row) => row[0]?.toString().toLowerCase().trim() === originalName.toLowerCase().trim()
            );

            if (rowIndex === -1) throw new Error("Item not found");

            // Row index is 0-based. Sheet rows are 1-based.
            const sheetRow = rowIndex + 1; // e.g. Index 0 is Row 1 (Header), Index 1 is Row 2

            // 3. Update the Row (Columns A:E)
            const updateUrl = `${BASE_URL}/${spreadsheetId}/values/A${sheetRow}:E${sheetRow}?valueInputOption=USER_ENTERED`;
            const updateRes = await fetch(updateUrl, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    values: [[
                        itemData.name,
                        itemData.sku,
                        itemData.qty,
                        itemData.price,
                        itemData.category
                    ]],
                }),
            });

            const data = await updateRes.json();
            if (data.error) throw new Error(data.error.message);
            return true;

        } catch (error) {
            console.error("Error updating item:", error);
            throw error;
        }
    },

    /**
     * Batch update stock for sold items
     * items: { name: string, qty: number }[]
     */
    async deductStock(token, spreadsheetId, soldItems) {
        try {
            // 1. Fetch current data to find row indices
            // Reading Name(A), SKU(B), Qty(C)
            const readUrl = `${BASE_URL}/${spreadsheetId}/values/A2:C`;
            const readRes = await fetch(readUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const readData = await readRes.json();
            const rows = readData.values || [];

            const dataToUpdate = [];

            // 2. Map sold items to rows
            soldItems.forEach((item) => {
                // Find row by Name (Column A) - robust matching
                const rowIndex = rows.findIndex(
                    (row) =>
                        row[0]?.toString().toLowerCase().trim() ===
                        item.name.toLowerCase().trim()
                );

                if (rowIndex !== -1) {
                    const currentQty = parseInt(rows[rowIndex][2] || "0");
                    const newQty = Math.max(0, currentQty - item.qty);
                    // Row index is 0-based from the range start.
                    // Range start is A2, so actual sheet row is rowIndex + 2.
                    const sheetRow = rowIndex + 2;

                    dataToUpdate.push({
                        range: `C${sheetRow}`, // Updating Column C (Quantity)
                        values: [[newQty]],
                    });
                }
            });

            if (dataToUpdate.length === 0)
                return { success: true, message: "No matching items found to update" };

            // 3. Batch Update
            const batchUrl = `${BASE_URL}/${spreadsheetId}/values:batchUpdate`;
            const batchRes = await fetch(batchUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    valueInputOption: "USER_ENTERED",
                    data: dataToUpdate,
                }),
            });

            const batchData = await batchRes.json();
            if (batchData.error) throw new Error(batchData.error.message);

            return { success: true, updated: dataToUpdate.length };
        } catch (error) {
            console.error("Error deducting stock:", error);
            throw error;
        }
    },

    /**
     * Create "Sales" sheet if not exists
     */
    async initializeSalesSheet(token, spreadsheetId) {
        try {
            // 1. Check if sheet exists
            const checkUrl = `${BASE_URL}/${spreadsheetId}/values/Sales!A1:E1`;
            const checkRes = await fetch(checkUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });

            // If 400 (Bad Request), likely sheet doesn't exist
            if (checkRes.status !== 200) {
                // Create Sheet "Sales"
                const addSheetUrl = `${BASE_URL}/${spreadsheetId}:batchUpdate`;
                await fetch(addSheetUrl, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        requests: [{
                            addSheet: {
                                properties: { title: "Sales" }
                            }
                        }]
                    })
                });
            }

            // 2. Ensure Headers are Correct (Update A1:E1)
            // We do this always to ensure "Item Details" column exists for legacy sheets
            const updateUrl = `${BASE_URL}/${spreadsheetId}/values/Sales!A1:E1?valueInputOption=USER_ENTERED`;
            await fetch(updateUrl, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    values: [["Date", "Total Amount", "Items Count", "Invoice ID", "Item Details"]],
                }),
            });

        } catch (e) {
            console.error("Init Sales Sheet error", e);
        }
    },

    /**
     * Record a new sale to "Sales" sheet
     */
    async recordSale(token, spreadsheetId, saleData) {
        try {
            // Ensure sheet exists first
            await this.initializeSalesSheet(token, spreadsheetId);

            const url = `${BASE_URL}/${spreadsheetId}/values/Sales!A1:append?valueInputOption=USER_ENTERED`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    values: [[
                        saleData.date,
                        saleData.amount,
                        saleData.itemsCount,
                        saleData.invoiceId,
                        JSON.stringify(saleData.items || [])
                    ]],
                }),
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            return true;
        } catch (error) {
            console.error("Error recording sale:", error);
            // Don't throw, just log. We don't want to block the UI if metrics fail.
            return false;
        }
    },

    /**
     * Get Sales History
     */
    async getSalesHistory(token, spreadsheetId) {
        try {
            const url = `${BASE_URL}/${spreadsheetId}/values/Sales!A2:E`;
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) return []; // Might not exist yet

            const data = await response.json();
            return data.values || [];
        } catch (error) {
            console.error("Error fetching sales history:", error);
            return [];
        }
    }
};
