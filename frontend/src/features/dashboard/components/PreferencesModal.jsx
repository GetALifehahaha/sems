import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/shared";

const validate = ({ targetKwh, costRate, cycleStartDay }) => {
    const errors = {};
    const kwh = Number(targetKwh);
    const rate = Number(costRate);
    const day = Number(cycleStartDay);
    if (!targetKwh || isNaN(kwh) || kwh < 1 || kwh > 10000)
        errors.targetKwh = "Enter a value between 1 and 10,000 kWh.";
    if (!costRate || isNaN(rate) || rate < 0.01 || rate > 1000)
        errors.costRate = "Enter a rate between ₱0.01 and ₱1,000.";
    if (!cycleStartDay || isNaN(day) || day < 1 || day > 28)
        errors.cycleStartDay = "Select a day between 1 and 28.";
    return errors;
};

const PreferencesModal = ({ prefs, saving, saveError, onSave, onClose }) => {
    const [form, setForm] = useState({
        targetKwh: String(prefs.targetKwh),
        costRate: String(prefs.costRate),
        cycleStartDay: String(prefs.cycleStartDay),
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        setForm({
            targetKwh: String(prefs.targetKwh),
            costRate: String(prefs.costRate),
            cycleStartDay: String(prefs.cycleStartDay),
        });
    }, [prefs]);

    const isDirty =
        Number(form.targetKwh) !== prefs.targetKwh ||
        Number(form.costRate) !== prefs.costRate ||
        Number(form.cycleStartDay) !== prefs.cycleStartDay;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: undefined }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationErrors = validate(form);
        if (Object.keys(validationErrors).length) {
            setErrors(validationErrors);
            return;
        }
        const ok = await onSave({
            targetKwh: Number(form.targetKwh),
            costRate: Number(form.costRate),
            cycleStartDay: Number(form.cycleStartDay),
        });
        if (ok) onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-bold">Budget Preferences</h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-background rounded"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                    {/* Monthly Target */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Monthly Target (kWh)
                        </label>
                        <input
                            type="number"
                            name="targetKwh"
                            value={form.targetKwh}
                            onChange={handleChange}
                            min={1}
                            max={10000}
                            step="1"
                            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                                errors.targetKwh ? "border-red-400" : "border-border"
                            }`}
                        />
                        {errors.targetKwh && (
                            <p className="text-xs text-red-500 mt-1">{errors.targetKwh}</p>
                        )}
                    </div>

                    {/* Cost Rate */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Cost Rate (₱/kWh)
                        </label>
                        <input
                            type="number"
                            name="costRate"
                            value={form.costRate}
                            onChange={handleChange}
                            min={0.01}
                            max={1000}
                            step="0.01"
                            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                                errors.costRate ? "border-red-400" : "border-border"
                            }`}
                        />
                        {errors.costRate && (
                            <p className="text-xs text-red-500 mt-1">{errors.costRate}</p>
                        )}
                    </div>

                    {/* Billing Cycle Start Day */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Billing Cycle Start Day
                        </label>
                        <select
                            name="cycleStartDay"
                            value={form.cycleStartDay}
                            onChange={handleChange}
                            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white ${
                                errors.cycleStartDay ? "border-red-400" : "border-border"
                            }`}
                        >
                            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                                <option key={day} value={day}>
                                    {day}
                                    {day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th"} of every month
                                </option>
                            ))}
                        </select>
                        {errors.cycleStartDay && (
                            <p className="text-xs text-red-500 mt-1">{errors.cycleStartDay}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                            Days Left and Daily Allowance are calculated from this date.
                        </p>
                    </div>

                    {saveError && (
                        <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
                            {saveError}
                        </p>
                    )}

                    <div className="flex gap-2 pt-1">
                        <Button
                            text="Cancel"
                            onClick={onClose}
                            className="flex-1 border border-border rounded-lg py-2 text-sm font-medium text-text/70 hover:bg-background"
                        />
                        <button
                            type="submit"
                            disabled={saving || !isDirty}
                            className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                        >
                            {saving ? "Saving…" : "Save"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PreferencesModal;
