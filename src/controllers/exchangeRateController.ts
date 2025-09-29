import { Request, Response } from 'express';
import { ApiResponse } from '@/types/common';
import { ExchangeRateService } from '@/services/exchangeRateService';

export class ExchangeRateController {
  // Get current exchange rates
  static async getCurrentRates(req: Request, res: Response): Promise<void> {
    try {
      const { base = 'USD', currencies } = req.query;

      const rates = await ExchangeRateService.getExchangeRates(base as string);

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
      const updateStatus = await ExchangeRateService.getRateUpdateStatus();

      const response: ApiResponse = {
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
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve exchange rates',
      };
      res.status(500).json(response);
    }
  }

  // Convert currency amount
  static async convertCurrency(req: Request, res: Response): Promise<void> {
    try {
      const { amount, from, to } = req.query;

      if (!amount || !from || !to) {
        const response: ApiResponse = {
          success: false,
          message: 'Amount, from, and to currencies are required',
        };
        res.status(400).json(response);
        return;
      }

      const conversion = await ExchangeRateService.convertCurrency(
        parseFloat(amount as string),
        from as string,
        to as string,
      );

      const response: ApiResponse = {
        success: true,
        message: 'Currency converted successfully',
        data: {
          originalAmount: parseFloat(amount as string),
          fromCurrency: from,
          toCurrency: to,
          convertedAmount: conversion.convertedAmount,
          exchangeRate: conversion.rate,
          timestamp: conversion.timestamp,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to convert currency',
      };
      res.status(500).json(response);
    }
  }

  // Get currency information
  static async getCurrencyInfo(req: Request, res: Response): Promise<void> {
    try {
      const { currency } = req.params;

      if (!currency) {
        const response: ApiResponse = {
          success: false,
          message: 'Currency code is required',
        };
        res.status(400).json(response);
        return;
      }

      const info = ExchangeRateService.getCurrencyInfo(currency.toUpperCase());

      const response: ApiResponse = {
        success: true,
        message: 'Currency information retrieved successfully',
        data: info,
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve currency information',
      };
      res.status(500).json(response);
    }
  }

  // Get all supported currencies
  static async getSupportedCurrencies(req: Request, res: Response): Promise<void> {
    try {
      const supportedCurrencies = ExchangeRateService.getSupportedCurrencies();

      const currenciesWithInfo = supportedCurrencies.map(code => ({
        code,
        ...ExchangeRateService.getCurrencyInfo(code),
      }));

      const response: ApiResponse = {
        success: true,
        message: 'Supported currencies retrieved successfully',
        data: currenciesWithInfo,
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve supported currencies',
      };
      res.status(500).json(response);
    }
  }

  // Manually update exchange rates (admin endpoint)
  static async updateRates(req: Request, res: Response): Promise<void> {
    try {
      const success = await ExchangeRateService.updateExchangeRates();

      if (success) {
        const response: ApiResponse = {
          success: true,
          message: 'Exchange rates updated successfully',
        };
        res.status(200).json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          message: 'Failed to update exchange rates',
        };
        res.status(500).json(response);
      }
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to update exchange rates',
      };
      res.status(500).json(response);
    }
  }
}
