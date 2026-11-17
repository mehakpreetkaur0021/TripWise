import axios from 'axios';
import { ENV } from '../config/env.js';

const TICKETLENS_BASE_URL = 'https://api.ticketlens.com/v1';

/**
 * TicketLens API Integration Service.
 *
 * NOTE: TicketLens does not offer an open public free tier for attraction ticket pricing.
 * If credentials are not provided or the documentation/endpoints cannot be authenticated,
 * the service reports status as "unconfigured_unverified" and returns empty results.
 * It NEVER fabricates fake ticket prices.
 */
export async function searchActivityTickets(attractionName, city = 'Udaipur') {
  // If no API key is provided, report integration as unavailable
  if (!ENV.TICKETLENS_API_KEY) {
    return {
      status: 'unconfigured',
      isLive: false,
      provider: 'TicketLens',
      message:
        'TicketLens API credentials not configured. Free-tier access for tourist ticket pricing is unverified. Falling back to official registry & category estimator.',
      tickets: [],
    };
  }

  try {
    const response = await axios.get(`${TICKETLENS_BASE_URL}/experiences/search`, {
      params: {
        query: `${attractionName} ${city}`,
        currency: 'INR',
      },
      headers: {
        Authorization: `Bearer ${ENV.TICKETLENS_API_KEY}`,
        Accept: 'application/json',
      },
      timeout: 5000,
    });

    const items = response.data?.results || response.data?.experiences || [];
    if (!Array.isArray(items) || items.length === 0) {
      return {
        status: 'no_results',
        isLive: true,
        provider: 'TicketLens',
        tickets: [],
      };
    }

    // Map usable prices from real TicketLens results
    const tickets = items
      .filter((item) => item.price && item.price.amount)
      .map((item) => ({
        title: item.title || item.name,
        amount: Math.round(item.price.amount),
        currency: item.price.currency || 'INR',
        providerName: item.provider || 'TicketLens Partner',
        bookingUrl: item.url || null,
        confidence: 0.95,
      }));

    return {
      status: 'success',
      isLive: true,
      provider: 'TicketLens',
      tickets,
    };
  } catch (err) {
    console.warn(`[TicketLens] API call failed for "${attractionName}": ${err.message}`);
    return {
      status: 'error',
      isLive: false,
      provider: 'TicketLens',
      error: err.message,
      tickets: [],
    };
  }
}
