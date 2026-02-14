import React from 'react';
import { Store, ArrowRight, Plus } from 'lucide-react';
import { Button } from './ui/Shared';

export default function SheetSelector({ sheets, onSelect, onCreateNew }) {
    return (
        <div className="flex flex-col items-center w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center border border-emerald-500/30">
                <Store size={32} className="text-emerald-400" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2 text-center">Found Existing Shops</h2>
            <p className="text-white/60 text-center mb-8">
                We found existing TrackEezy data in your Google Drive. Would you like to continue with one of these?
            </p>

            <div className="w-full space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {sheets.length === 0 ? (
                    <div className="text-center py-6 px-4 bg-white/5 rounded-xl border border-white/10 border-dashed">
                        <p className="text-white/60 text-sm mb-1">No existing AapKaBakaya shops found.</p>
                        <p className="text-white/40 text-xs">Check your Google Drive or create a new one.</p>
                    </div>
                ) : (
                    sheets.map((sheet) => (
                        <button
                            key={sheet.id}
                            onClick={() => onSelect(sheet)}
                            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-emerald-500/50 transition-all group text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                    <Store size={20} />
                                </div>
                                <div>
                                    <h3 className="text-white font-medium group-hover:text-emerald-400 transition-colors">
                                        {sheet.name.replace(" - Inventory (AapKaBakaya)", "").replace(" - Inventory (BijNex)", "").replace(" - Inventory (TrackEezy)", "")}
                                    </h3>
                                    <p className="text-xs text-white/40">Last modified recently</p>
                                </div>
                            </div>
                            <ArrowRight size={18} className="text-white/20 group-hover:text-emerald-400 transition-colors" />
                        </button>
                    ))
                )}
            </div>

            <div className="w-full relative py-4">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[#0a0a0a] px-2 text-white/40">Or create new</span>
                </div>
            </div>

            <Button
                variant="ghost"
                onClick={onCreateNew}
                className="w-full text-white/60 hover:text-white"
            >
                <Plus size={18} className="mr-2" />
                Create a New Shop
            </Button>
        </div>
    );
}
