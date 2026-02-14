
const BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_URL = "https://www.googleapis.com/drive/v3/files";

export const GoogleSheetsService = {
    /**
     * Search for existing BijNex sheets in user's Google Drive
     * Returns array of { id, name, url } or empty array
     */
    async searchExistingSheets(token, customQuery = null) {
        try {
            // Default: Search for "AapKaBakaya"
            // If customQuery is provided (e.g. empty string for all), use that.
            let query = customQuery;
            if (!query) {
                // Search for ANY valid inventory sheet variants
                query = "(name contains 'AapKaBakaya' or name contains 'BijNex' or name contains 'Biznex') and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
            }

            const encodedQuery = encodeURIComponent(query);
            const url = `${DRIVE_URL}?q=${encodedQuery}&fields=files(id,name,webViewLink)&orderBy=modifiedTime desc`;

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error("Drive API Error:", response.status, errorBody);
                throw new Error(`Drive API Failed: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            return (data.files || []).map(file => ({
                id: file.id,
                name: file.name,
                url: file.webViewLink
            }));
        } catch (error) {
            console.error("Error searching for sheets:", error);
            throw error; // Propagate error
        }
    },

    /**
     * Initialize UserLogins sheet for tracking all logins (Admin feature)
     * Headers: Timestamp, Email, Name, LoginCount
     */
    async initializeUserLoginsSheet(token, spreadsheetId) {
        try {
            // First check if sheet exists
            const metaUrl = `${BASE_URL}/${spreadsheetId}?fields=sheets.properties.title`;
            const metaRes = await fetch(metaUrl, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const meta = await metaRes.json();
            const sheetExists = meta.sheets?.some(s => s.properties?.title === "UserLogins");

            if (!sheetExists) {
                // Create the sheet
                const createUrl = `${BASE_URL}/${spreadsheetId}:batchUpdate`;
                await fetch(createUrl, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        requests: [{
                            addSheet: {
                                properties: {
                                    title: "UserLogins",
                                    gridProperties: { frozenRowCount: 1 }
                                }
                            }
                        }]
                    })
                });

                // Add headers
                const headerUrl = `${BASE_URL}/${spreadsheetId}/values/UserLogins!A1:E1?valueInputOption=RAW`;
                await fetch(headerUrl, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        values: [["Timestamp", "Email", "Name", "Picture", "Login Count"]]
                    })
                });
            }
            return true;
        } catch (error) {
            console.error("Error initializing UserLogins sheet:", error);
            return false;
        }
    },

    /**
     * Log a user login and return total unique users count
     */
    async logUserLogin(token, spreadsheetId, userInfo) {
        try {
            // Initialize sheet if needed
            await this.initializeUserLoginsSheet(token, spreadsheetId);

            // Get existing logins to check if user already exists
            const getUrl = `${BASE_URL}/${spreadsheetId}/values/UserLogins!A2:E`;
            const getRes = await fetch(getUrl, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const getData = await getRes.json();
            const rows = getData.values || [];

            // Find if this email already exists
            const existingIndex = rows.findIndex(row => row[1] === userInfo.email);

            if (existingIndex >= 0) {
                // Update existing row - increment login count
                const currentCount = parseInt(rows[existingIndex][4] || "0") || 0;
                const rowNum = existingIndex + 2; // 1-indexed + header row
                const updateUrl = `${BASE_URL}/${spreadsheetId}/values/UserLogins!A${rowNum}:E${rowNum}?valueInputOption=RAW`;
                await fetch(updateUrl, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        values: [[
                            new Date().toISOString(),
                            userInfo.email,
                            userInfo.name || "",
                            userInfo.picture || "",
                            currentCount + 1
                        ]]
                    })
                });
            } else {
                // Add new user
                const appendUrl = `${BASE_URL}/${spreadsheetId}/values/UserLogins!A:E:append?valueInputOption=RAW`;
                await fetch(appendUrl, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        values: [[
                            new Date().toISOString(),
                            userInfo.email,
                            userInfo.name || "",
                            userInfo.picture || "",
                            1
                        ]]
                    })
                });
            }

            // Return unique user count
            const uniqueEmails = new Set(rows.map(r => r[1]).filter(Boolean));
            if (!uniqueEmails.has(userInfo.email)) uniqueEmails.add(userInfo.email);
            return uniqueEmails.size;
        } catch (error) {
            console.error("Error logging user login:", error);
            return 0;
        }
    },

    /**
     * Get all logged in users (for Admin)
     */
    async getUserLogins(token, spreadsheetId) {
        try {
            await this.initializeUserLoginsSheet(token, spreadsheetId);

            const url = `${BASE_URL}/${spreadsheetId}/values/UserLogins!A2:E`;
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            return (data.values || []).map(row => ({
                timestamp: row[0] || "",
                email: row[1] || "",
                name: row[2] || "",
                picture: row[3] || "",
                loginCount: parseInt(row[4] || "0") || 0
            }));
        } catch (error) {
            console.error("Error getting user logins:", error);
            return [];
        }
    },

    /**
     * Reads all data from the first sheet (assuming it's Inventory)
     * Headers expected: Name, SKU, Qty, Price, Category
     */
    async getInventory(token, spreadsheetId) {
        try {
            console.log("Fetching inventory...", { spreadsheetId, token: token?.slice(0, 10) + "..." });
            // Ensure headers are up to date (auto-migrates GST % column for existing sheets)
            await this.initializeSheet(token, spreadsheetId);
            // Fetch A2:K to skip headers (K = GST %)
            const url = `${BASE_URL}/${spreadsheetId}/values/A2:K`;
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

            const rows = data.values || [];

            // Map rows to objects
            // Columns: 0:Name, 1:SKU, 2:Qty, 3:Price, 4:BaseUnit, 5:DisplayUnit, 6:ConvFactor, 7:Expiry, 8:Batch, 9:HSN, 10:GST%
            const inventory = rows.map((row, index) => {
                if (!row[0]) return null; // Skip empty names

                const factor = parseFloat(row[6]?.toString().replace(/,/g, '')) || 1;
                const qty = parseFloat(row[2]?.toString().replace(/,/g, '')) || 0;

                return {
                    id: `${row[1] || 'sku'}-${index}-${Date.now()}`, // Temporary stable ID
                    name: row[0],
                    sku: row[1] || "",
                    qty: qty,
                    price: parseFloat(row[3]?.toString().replace(/,/g, '')) || 0,
                    baseUnit: row[4] || "gram",
                    displayUnit: row[5] || "kilogram",
                    conversionFactor: factor,
                    low: (qty / factor) < 10, // Low stock logic
                    expiryDate: row[7] || "",
                    batchNo: row[8] || "",
                    hsnCode: row[9] || "",
                    gstPercent: (!isNaN(parseFloat(row[10]))) ? parseFloat(row[10]) : 18
                };
            }).filter(item => item !== null); // Remove nulls

            return inventory;
        } catch (error) {
            console.error("Error fetching inventory:", error);
            throw error;
        }
    },

    /**
     * Create a new Google Sheet automatically
     */
    async createInventorySheet(token, shopName) {
        try {
            const url = `${BASE_URL}`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    properties: {
                        title: `${shopName || "My Shop"} - Inventory (AapKaBakaya)`
                    },
                    sheets: [
                        {
                            properties: {
                                title: "Inventory",
                                gridProperties: {
                                    frozenRowCount: 1
                                }
                            }
                        },
                        {
                            properties: {
                                title: "Sales",
                                gridProperties: {
                                    frozenRowCount: 1
                                }
                            }
                        }
                    ]
                }),
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            const spreadsheetId = data.spreadsheetId;

            // Initialize Headers for Inventory
            await this.initializeSheet(token, spreadsheetId);

            // Initialize Headers for Sales
            await this.initializeSalesSheet(token, spreadsheetId);

            return data.spreadsheetUrl; // Returns the full URL
        } catch (error) {
            console.error("Error creating sheet:", error);
            throw error;
        }
    },
    async addStock(token, spreadsheetId, rowData) {
        try {
            // rowData now has 7 items
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
            // Check if headers exist in A1:K1 AND check formatting of A1
            const checkUrl = `${BASE_URL}/${spreadsheetId}/values/A1:K1?valueRenderOption=UNFORMATTED_VALUE`;
            // We also need to check formatting, but values endpoint doesn't return format. 
            // We'll optimistically check specific formatting via a separate call or just rely on a flag.
            // To be robust and avoid extra calls on every load for established sheets, let's use the spreadsheet.get method for A1's format.

            // 1. Fetch values
            const checkRes = await fetch(checkUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const checkData = await checkRes.json();
            const rows = checkData.values || [];

            // 2. Fetch A1 formatting to see if we need to apply styles
            const formatUrl = `${BASE_URL}/${spreadsheetId}?ranges=A1&fields=sheets.data.rowData.values.userEnteredFormat.backgroundColor`;
            const formatRes = await fetch(formatUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const formatData = await formatRes.json();
            // Check if A1 has our specific dark teal background color (approximate check)
            const a1Format = formatData.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.userEnteredFormat;
            const bgColor = a1Format?.backgroundColor || {};
            // Desired: Red: 0.106, Green: 0.263, Blue: 0.196
            // We'll check if it's missing or significantly different
            const isFormatted =
                Math.abs((bgColor.red || 0) - 0.106) < 0.01 &&
                Math.abs((bgColor.green || 0) - 0.263) < 0.01 &&
                Math.abs((bgColor.blue || 0) - 0.196) < 0.01;

            let needsFormatting = !isFormatted;

            // If first row is empty, write all headers
            if (rows.length === 0) {
                const updateUrl = `${BASE_URL}/${spreadsheetId}/values/A1:K1?valueInputOption=USER_ENTERED`;
                await fetch(updateUrl, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        values: [["Product Name", "SKU", "Quantity", "Price", "Base Unit", "Display Unit", "Conversion Factor", "Expiry Date", "Batch No", "HSN Code", "GST %"]],
                    }),
                });
                needsFormatting = true;
            } else if (!rows[0][10]) {
                // Migration: existing sheet missing GST % header in column K
                const updateUrl = `${BASE_URL}/${spreadsheetId}/values/K1?valueInputOption=USER_ENTERED`;
                await fetch(updateUrl, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        values: [["GST %"]],
                    }),
                });
                needsFormatting = true;
            }

            // Apply bold + background formatting to header row
            if (needsFormatting) {
                // Get sheet ID
                const metaUrl = `${BASE_URL}/${spreadsheetId}?fields=sheets.properties`;
                const metaRes = await fetch(metaUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const metaData = await metaRes.json();
                const sheetId = metaData.sheets?.[0]?.properties?.sheetId || 0;

                const formatUrl = `${BASE_URL}/${spreadsheetId}:batchUpdate`;
                await fetch(formatUrl, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        requests: [{
                            repeatCell: {
                                range: {
                                    sheetId: sheetId,
                                    startRowIndex: 0,
                                    endRowIndex: 1,
                                    startColumnIndex: 0,
                                    endColumnIndex: 11 // A to K
                                },
                                cell: {
                                    userEnteredFormat: {
                                        backgroundColor: { red: 0.106, green: 0.263, blue: 0.196 }, // Dark Teal #1B4332
                                        textFormat: {
                                            bold: true,
                                            foregroundColor: { red: 1, green: 1, blue: 1 }, // White text
                                            fontSize: 11
                                        },
                                        horizontalAlignment: "CENTER"
                                    }
                                },
                                fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
                            }
                        }]
                    }),
                });
            }
        } catch (e) {
            console.error("Init sheet error", e);
        }
    },

    /**
     * Update an item's details
     * Finds the row by originalName and updates all columns (A:G)
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

            // 3. Update the Row (Columns A:K)
            const updateUrl = `${BASE_URL}/${spreadsheetId}/values/A${sheetRow}:K${sheetRow}?valueInputOption=USER_ENTERED`;
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
                        itemData.baseUnit,
                        itemData.displayUnit,
                        itemData.conversionFactor,
                        itemData.expiryDate || '',
                        itemData.batchNo || '',
                        itemData.hsnCode || '',
                        itemData.gstPercent != null ? itemData.gstPercent : 18
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
     * Delete an item from inventory
     * Finds row by name and deletes it
     */
    async deleteItem(token, spreadsheetId, itemName) {
        try {
            // 1. Get sheet ID (needed for delete request)
            const metaUrl = `${BASE_URL}/${spreadsheetId}`;
            const metaRes = await fetch(metaUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const metaData = await metaRes.json();
            const sheetId = metaData.sheets?.[0]?.properties?.sheetId || 0;

            // 2. Find row index
            const readUrl = `${BASE_URL}/${spreadsheetId}/values/A:A`;
            const readRes = await fetch(readUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const readData = await readRes.json();
            const rows = readData.values || [];

            const rowIndex = rows.findIndex(
                (row) => row[0]?.toString().toLowerCase().trim() === itemName.toLowerCase().trim()
            );

            if (rowIndex === -1) throw new Error("Item not found");

            // 3. Delete row using batchUpdate
            const deleteUrl = `${BASE_URL}/${spreadsheetId}:batchUpdate`;
            const deleteRes = await fetch(deleteUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: "ROWS",
                                startIndex: rowIndex,
                                endIndex: rowIndex + 1
                            }
                        }
                    }]
                }),
            });

            const deleteData = await deleteRes.json();
            if (deleteData.error) throw new Error(deleteData.error.message);
            return true;

        } catch (error) {
            console.error("Error deleting item:", error);
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
            // Reading Name(A) to Factor(G)
            const readUrl = `${BASE_URL}/${spreadsheetId}/values/A2:G`;
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
                    const row = rows[rowIndex];
                    const currentQty = parseFloat(row[2] || "0"); // Base Unit Qty
                    const conversionFactor = parseFloat(row[6] || "1"); // Factor

                    // Deduction in Base Units = Sold Qty (Display) * Factor
                    const deductionBase = item.qty * conversionFactor;

                    const newQty = Math.max(0, currentQty - deductionBase);

                    // Row index is 0-based from the range start (A2).
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

            // 2. Ensure Headers are Correct and Formatted
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

            // Check formatting of Sales!A1
            const formatUrl = `${BASE_URL}/${spreadsheetId}?ranges=Sales!A1&fields=sheets.data.rowData.values.userEnteredFormat.backgroundColor`;
            const formatRes = await fetch(formatUrl, { headers: { Authorization: `Bearer ${token}` } });
            const formatData = await formatRes.json();
            const a1Format = formatData.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.userEnteredFormat;
            const bgColor = a1Format?.backgroundColor || {};
            const isFormatted =
                Math.abs((bgColor.red || 0) - 0.106) < 0.01 &&
                Math.abs((bgColor.green || 0) - 0.263) < 0.01 &&
                Math.abs((bgColor.blue || 0) - 0.196) < 0.01;

            if (!isFormatted) {
                // Get sheet ID for "Sales"
                const metaUrl = `${BASE_URL}/${spreadsheetId}?fields=sheets.properties`;
                const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
                const metaData = await metaRes.json();
                const sheetId = metaData.sheets?.find(s => s.properties?.title === "Sales")?.properties?.sheetId;

                if (sheetId !== undefined) {
                    const batchUrl = `${BASE_URL}/${spreadsheetId}:batchUpdate`;
                    await fetch(batchUrl, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            requests: [{
                                repeatCell: {
                                    range: {
                                        sheetId: sheetId,
                                        startRowIndex: 0,
                                        endRowIndex: 1,
                                        startColumnIndex: 0,
                                        endColumnIndex: 5 // A to E
                                    },
                                    cell: {
                                        userEnteredFormat: {
                                            backgroundColor: { red: 0.106, green: 0.263, blue: 0.196 }, // Dark Teal
                                            textFormat: {
                                                bold: true,
                                                foregroundColor: { red: 1, green: 1, blue: 1 }, // White
                                                fontSize: 11
                                            },
                                            horizontalAlignment: "CENTER"
                                        }
                                    },
                                    fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
                                }
                            }]
                        }),
                    });
                }
            }
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
            // Ensure sheet exists and headers are formatted
            await this.initializeSalesSheet(token, spreadsheetId);
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
    },

    /**
     * Initialize "AuthorizedUsers" sheet if not exists
     */
    async initializeAuthSheet(token, spreadsheetId) {
        try {
            // Check if sheet exists
            const checkUrl = `${BASE_URL}/${spreadsheetId}/values/AuthorizedUsers!A1:E1`;
            const checkRes = await fetch(checkUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });

            // If 400, sheet doesn't exist
            if (checkRes.status !== 200) {
                // Create Sheet
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
                                properties: { title: "AuthorizedUsers" }
                            }
                        }]
                    })
                });
            }

            // Ensure Headers exist
            const updateUrl = `${BASE_URL}/${spreadsheetId}/values/AuthorizedUsers!A1:E1?valueInputOption=USER_ENTERED`;
            await fetch(updateUrl, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    values: [["Name", "Phone", "Email", "Role", "Active"]],
                }),
            });

        } catch (e) {
            console.error("Init AuthorizedUsers Sheet error", e);
        }
    },

    /**
     * Get all authorized users
     */
    async getAuthorizedUsers(token, spreadsheetId) {
        try {
            // Ensure sheet exists
            await this.initializeAuthSheet(token, spreadsheetId);

            const url = `${BASE_URL}/${spreadsheetId}/values/AuthorizedUsers!A2:E`;
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) return [];

            const data = await response.json();
            const rows = data.values || [];

            return rows.map(row => ({
                name: row[0] || '',
                phone: row[1] || '',
                email: row[2] || '',
                role: row[3] || 'staff',
                active: row[4] !== 'FALSE'
            }));
        } catch (error) {
            console.error("Error fetching authorized users:", error);
            return [];
        }
    },

    /**
     * Add a new authorized user
     */
    async addAuthorizedUser(token, spreadsheetId, userData) {
        try {
            // Ensure sheet exists
            await this.initializeAuthSheet(token, spreadsheetId);

            const url = `${BASE_URL}/${spreadsheetId}/values/AuthorizedUsers!A1:append?valueInputOption=USER_ENTERED`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    values: [[
                        userData.name,
                        userData.phone,
                        userData.email,
                        userData.role || 'staff',
                        userData.active !== false ? 'TRUE' : 'FALSE'
                    ]],
                }),
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            return true;
        } catch (error) {
            console.error("Error adding authorized user:", error);
            throw error;
        }
    },

    /**
     * Remove an authorized user by row index
     * rowIndex is 1-based (row 2 = first data row)
     */
    async removeAuthorizedUser(token, spreadsheetId, rowIndex) {
        try {
            // Get sheet ID
            const metaUrl = `${BASE_URL}/${spreadsheetId}`;
            const metaRes = await fetch(metaUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const metaData = await metaRes.json();

            // Find AuthorizedUsers sheet ID
            const sheet = metaData.sheets?.find(s => s.properties?.title === 'AuthorizedUsers');
            if (!sheet) throw new Error("AuthorizedUsers sheet not found");
            const sheetId = sheet.properties.sheetId;

            // Delete row
            const deleteUrl = `${BASE_URL}/${spreadsheetId}:batchUpdate`;
            const deleteRes = await fetch(deleteUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: "ROWS",
                                startIndex: rowIndex - 1,  // 0-based
                                endIndex: rowIndex
                            }
                        }
                    }]
                }),
            });

            const deleteData = await deleteRes.json();
            if (deleteData.error) throw new Error(deleteData.error.message);
            return true;

        } catch (error) {
            console.error("Error removing user:", error);
            throw error;
        }
    },

    /**
     * Check if a user is authorized (by email or phone)
     */
    async isUserAuthorized(token, spreadsheetId, identifier) {
        try {
            const users = await this.getAuthorizedUsers(token, spreadsheetId);
            const lowerIdentifier = identifier.toLowerCase();

            return users.some(user =>
                user.active !== false && (
                    (user.email && user.email.toLowerCase() === lowerIdentifier) ||
                    (user.phone && user.phone === identifier)
                )
            );
        } catch (error) {
            console.error("Error checking user authorization:", error);
            return false;
        }
    },

    // ==========================================
    // PHASE 5: CUSTOMERS / KHATA / LEDGER
    // ==========================================

    /**
     * Initialize Customers sheet with headers
     * Headers: Name, Phone, Balance, LastTransaction, Notes
     */
    async initializeCustomersSheet(token, spreadsheetId) {
        try {
            // First, check if Customers sheet exists, if not create it
            const metaUrl = `${BASE_URL}/${spreadsheetId}`;
            const metaRes = await fetch(metaUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const metaData = await metaRes.json();

            const customersSheet = metaData.sheets?.find(s => s.properties.title === 'Customers');

            if (!customersSheet) {
                // Create the Customers sheet
                await fetch(`${BASE_URL}/${spreadsheetId}:batchUpdate`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        requests: [{
                            addSheet: {
                                properties: {
                                    title: "Customers",
                                    gridProperties: { frozenRowCount: 1 }
                                }
                            }
                        }]
                    }),
                });
            }

            // Check if headers exist
            const checkUrl = `${BASE_URL}/${spreadsheetId}/values/Customers!A1:E1`;
            const checkRes = await fetch(checkUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const checkData = await checkRes.json();
            const rows = checkData.values || [];

            if (rows.length === 0) {
                const updateUrl = `${BASE_URL}/${spreadsheetId}/values/Customers!A1:E1?valueInputOption=USER_ENTERED`;
                await fetch(updateUrl, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        values: [["Customer Name", "Phone", "Balance (₹)", "Last Transaction", "Notes"]],
                    }),
                });
            }
            return true;
        } catch (error) {
            console.error("Error initializing customers sheet:", error);
            throw error;
        }
    },

    /**
     * Initialize Ledger sheet for transaction history
     * Headers: Date, CustomerName, Type, Amount, Description, RunningBalance
     */
    async initializeLedgerSheet(token, spreadsheetId) {
        try {
            const metaUrl = `${BASE_URL}/${spreadsheetId}`;
            const metaRes = await fetch(metaUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const metaData = await metaRes.json();

            const ledgerSheet = metaData.sheets?.find(s => s.properties.title === 'Ledger');

            if (!ledgerSheet) {
                await fetch(`${BASE_URL}/${spreadsheetId}:batchUpdate`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        requests: [{
                            addSheet: {
                                properties: {
                                    title: "Ledger",
                                    gridProperties: { frozenRowCount: 1 }
                                }
                            }
                        }]
                    }),
                });
            }

            const checkUrl = `${BASE_URL}/${spreadsheetId}/values/Ledger!A1:F1`;
            const checkRes = await fetch(checkUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const checkData = await checkRes.json();
            const rows = checkData.values || [];

            if (rows.length === 0) {
                const updateUrl = `${BASE_URL}/${spreadsheetId}/values/Ledger!A1:F1?valueInputOption=USER_ENTERED`;
                await fetch(updateUrl, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        values: [["Date", "Customer Name", "Type", "Amount (₹)", "Description", "Running Balance"]],
                    }),
                });
            }
            return true;
        } catch (error) {
            console.error("Error initializing ledger sheet:", error);
            throw error;
        }
    },

    /**
     * Get all customers with their balances
     */
    async getCustomers(token, spreadsheetId) {
        try {
            await this.initializeCustomersSheet(token, spreadsheetId);

            const url = `${BASE_URL}/${spreadsheetId}/values/Customers!A2:E`;
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();

            if (data.error) throw new Error(data.error.message);

            return (data.values || []).map((row, i) => ({
                id: i + 2, // Row number in sheet
                name: row[0] || '',
                phone: row[1] || '',
                balance: parseFloat(row[2]) || 0,
                lastTransaction: row[3] || '',
                notes: row[4] || ''
            }));
        } catch (error) {
            console.error("Error getting customers:", error);
            throw error;
        }
    },

    /**
     * Add a new customer
     */
    async addCustomer(token, spreadsheetId, customerData) {
        try {
            await this.initializeCustomersSheet(token, spreadsheetId);

            const url = `${BASE_URL}/${spreadsheetId}/values/Customers!A1:append?valueInputOption=USER_ENTERED`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    values: [[
                        customerData.name,
                        customerData.phone || '',
                        0, // Initial balance
                        new Date().toISOString().split('T')[0],
                        customerData.notes || ''
                    ]],
                }),
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            return true;
        } catch (error) {
            console.error("Error adding customer:", error);
            throw error;
        }
    },

    /**
     * Add a ledger entry (credit sale or payment received)
     * Type: 'CREDIT' (customer owes us) or 'PAYMENT' (customer paid)
     */
    async addLedgerEntry(token, spreadsheetId, entry) {
        try {
            await this.initializeLedgerSheet(token, spreadsheetId);

            // 1. Add transaction to Ledger sheet
            const ledgerUrl = `${BASE_URL}/${spreadsheetId}/values/Ledger!A1:append?valueInputOption=USER_ENTERED`;
            await fetch(ledgerUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    values: [[
                        entry.date || new Date().toISOString().split('T')[0],
                        entry.customerName,
                        entry.type, // CREDIT or PAYMENT
                        entry.amount,
                        entry.description || '',
                        entry.runningBalance || ''
                    ]],
                }),
            });

            // 2. Update customer balance in Customers sheet
            const customers = await this.getCustomers(token, spreadsheetId);
            const customer = customers.find(c => c.name.toLowerCase() === entry.customerName.toLowerCase());

            if (customer) {
                const newBalance = entry.type === 'CREDIT'
                    ? customer.balance + entry.amount
                    : customer.balance - entry.amount;

                const updateUrl = `${BASE_URL}/${spreadsheetId}/values/Customers!C${customer.id}:D${customer.id}?valueInputOption=USER_ENTERED`;
                await fetch(updateUrl, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        values: [[newBalance, entry.date || new Date().toISOString().split('T')[0]]],
                    }),
                });
            }

            return true;
        } catch (error) {
            console.error("Error adding ledger entry:", error);
            throw error;
        }
    },

    /**
     * Get ledger entries for a customer
     */
    async getCustomerLedger(token, spreadsheetId, customerName) {
        try {
            await this.initializeLedgerSheet(token, spreadsheetId);

            const url = `${BASE_URL}/${spreadsheetId}/values/Ledger!A2:F`;
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();

            if (data.error) throw new Error(data.error.message);

            const allEntries = (data.values || []).map((row, i) => ({
                id: i + 2,
                date: row[0] || '',
                customerName: row[1] || '',
                type: row[2] || '',
                amount: parseFloat(row[3]) || 0,
                description: row[4] || '',
                runningBalance: parseFloat(row[5]) || 0
            }));

            // Filter by customer if specified
            if (customerName) {
                return allEntries.filter(e =>
                    e.customerName.toLowerCase() === customerName.toLowerCase()
                );
            }
            return allEntries;
        } catch (error) {
            console.error("Error getting ledger:", error);
            throw error;
        }
    }
};
