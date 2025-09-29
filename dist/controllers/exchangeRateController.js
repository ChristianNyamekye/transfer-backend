"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExchangeRateController = void 0;
const exchangeRateService_1 = require("@/services/exchangeRateService");
class ExchangeRateController {
    // Get current exchange rates
    static async getCurrentRates(req, res) {
        try {
            const { base = 'USD', currencies } = req.query;
            const rates = await exchangeRateService_1.ExchangeRateService.getExchangeRates(base);
            // Filter rates if specific currencies requested
            let filteredRates = rates;
            if (currencies && typeof currencies === 'string') {
                const requestedCurrencies = currencies.split(',').map(c => c.trim().toUpperCase());
                filteredRates = {};
                requestedCurrencies.forEach(currency => {
                    if (rates[currency]) {
                        filteredRates[currency] = rates[currency];
                    }
                });
            }
            // Get rate update status
            const updateStatus = await exchangeRateService_1.ExchangeRateService.getRateUpdateStatus();
            const response = {
                success: true,
                message: 'Exchange rates retrieved successfully',
                data: {
                    base: base,
                    rates: filteredRates,
                    lastUpdate: updateStatus.lastUpdate,
                    nextUpdate: updateStatus.nextUpdate,
                    source: updateStatus.source,
                    totalRates: Object.keys(filteredRates).length,
                },
            };
            res.status(200).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Failed to retrieve exchange rates',
            };
            res.status(500).json(response);
        }
    }
    // Convert currency amount
    static async convertCurrency(req, res) {
        try {
            const { amount, from, to } = req.query;
            if (!amount || !from || !to) {
                const response = {
                    success: false,
                    message: 'Amount, from, and to currencies are required',
                };
                res.status(400).json(response);
                return;
            }
            const conversion = await exchangeRateService_1.ExchangeRateService.convertCurrency(parseFloat(amount), from, to);
            const response = {
                success: true,
                message: 'Currency converted successfully',
                data: {
                    originalAmount: parseFloat(amount),
                    fromCurrency: from,
                    toCurrency: to,
                    convertedAmount: conversion.convertedAmount,
                    exchangeRate: conversion.rate,
                    timestamp: conversion.timestamp,
                },
            };
            res.status(200).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Failed to convert currency',
            };
            res.status(500).json(response);
        }
    }
    // Get currency information
    static async getCurrencyInfo(req, res) {
        try {
            const { currency } = req.params;
            if (!currency) {
                const response = {
                    success: false,
                    message: 'Currency code is required',
                };
                res.status(400).json(response);
                return;
            }
            const info = exchangeRateService_1.ExchangeRateService.getCurrencyInfo(currency.toUpperCase());
            const response = {
                success: true,
                message: 'Currency information retrieved successfully',
                data: info,
            };
            res.status(200).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Failed to retrieve currency information',
            };
            res.status(500).json(response);
        }
    }
    // Get all supported currencies
    static async getSupportedCurrencies(req, res) {
        try {
            const supportedCurrencies = exchangeRateService_1.ExchangeRateService.getSupportedCurrencies();
            const currenciesWithInfo = supportedCurrencies.map(code => ({
                code,
                ...exchangeRateService_1.ExchangeRateService.getCurrencyInfo(code),
            }));
            const response = {
                success: true,
                message: 'Supported currencies retrieved successfully',
                data: currenciesWithInfo,
            };
            res.status(200).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Failed to retrieve supported currencies',
            };
            res.status(500).json(response);
        }
    }
    // Manually update exchange rates (admin endpoint)
    static async updateRates(req, res) {
        try {
            const success = await exchangeRateService_1.ExchangeRateService.updateExchangeRates();
            if (success) {
                const response = {
                    success: true,
                    message: 'Exchange rates updated successfully',
                };
                res.status(200).json(response);
            }
            else {
                const response = {
                    success: false,
                    message: 'Failed to update exchange rates',
                };
                res.status(500).json(response);
            }
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Failed to update exchange rates',
            };
            res.status(500).json(response);
        }
    }
}
exports.ExchangeRateController = ExchangeRateController;
//# sourceMappingURL=exchangeRateController.js.map