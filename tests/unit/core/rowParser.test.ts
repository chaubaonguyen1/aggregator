import { describe, expect, it } from 'vitest';
import { HeaderError, RowParser } from '../../../src/core/rowParser.js';

const HEADER = 'campaign_id,date,impressions,clicks,spend,conversions';

const VALID_RECORD = {
  campaignId: 'CMP001',
  impressions: 12000,
  clicks: 300,
  spendCents: 4550,
  conversions: 12,
};

describe('RowParser.fromHeader', () => {
  it('points at CR-only line endings instead of reporting missing columns', () => {
    const crOnlyFile = `${HEADER}\rCMP001,2025-01-01,1,1,1.00,1\r`;
    expect(() => RowParser.fromHeader(crOnlyFile)).toThrow('CR-only line endings');
  });

  it('trims header names exactly like data fields', () => {
    const parser = RowParser.fromHeader(' campaign_id\t,date,impressions,clicks,spend,conversions');
    expect(parser.parse(' CMP001\t,2025-01-01,1,1,1.00,1')?.ok).toBe(true);
    const nonBreakingSpace = String.fromCharCode(0xa0);
    expect(() => RowParser.fromHeader(HEADER.replace('date', `date${nonBreakingSpace}`))).toThrow(
      HeaderError,
    );
  });

  it('rejects a header missing required columns', () => {
    expect(() => RowParser.fromHeader('campaign_id,date,impressions')).toThrow(HeaderError);
    expect(() => RowParser.fromHeader('campaign_id,date,impressions')).toThrow(
      'clicks, spend, conversions',
    );
  });

  it('accepts a header with a BOM, CRLF ending, spaces and different casing', () => {
    const parser = RowParser.fromHeader(
      `\uFEFFCampaign_ID, Date ,Impressions,Clicks,Spend,Conversions\r`,
    );
    expect(parser.parse('CMP001,2025-01-01,1,1,1.00,1')?.ok).toBe(true);
  });

  it('maps columns by name regardless of their order', () => {
    const parser = RowParser.fromHeader('spend,conversions,campaign_id,clicks,impressions,date');
    expect(parser.parse('45.50,12,CMP001,300,12000,2025-01-01')).toEqual({
      ok: true,
      record: VALID_RECORD,
    });
  });

  it('ignores extra columns', () => {
    const parser = RowParser.fromHeader(`${HEADER},note`);
    expect(parser.parse('CMP001,2025-01-01,10,1,1.00,1,anything')?.ok).toBe(true);
  });
});

describe('RowParser.parse', () => {
  const parser = RowParser.fromHeader(HEADER);

  it('parses a valid row', () => {
    expect(parser.parse('CMP001,2025-01-01,12000,300,45.50,12')).toEqual({
      ok: true,
      record: VALID_RECORD,
    });
  });

  it('strips a trailing carriage return', () => {
    expect(parser.parse('CMP001,2025-01-01,12000,300,45.50,12\r')).toEqual({
      ok: true,
      record: VALID_RECORD,
    });
  });

  it('ignores whitespace around fields, as it does in the header', () => {
    expect(parser.parse(' CMP001 , 2025-01-01,\t12000, 300 ,45.50 , 12 ')).toEqual({
      ok: true,
      record: VALID_RECORD,
    });
  });

  it.each(['', '\r', '   ', ' \t\r'])('returns null for the blank line %j', (line) => {
    expect(parser.parse(line)).toBeNull();
  });

  it.each([
    ['CMP001,2025-01-01,12000,300,45.50', 'wrong_column_count'],
    ['CMP001,2025-01-01,12000,300,45.50,12,extra', 'wrong_column_count'],
    [',2025-01-01,1', 'wrong_column_count'],
    ['"CMP001",2025-01-01,12000,300,45.50,12', 'quoted_field'],
    [',2025-01-01,12000,300,45.50,12', 'missing_campaign_id'],
    ['  ,2025-01-01,12000,300,45.50,12', 'missing_campaign_id'],
    ['CMP001,01-01-2025,12000,300,45.50,12', 'invalid_date'],
    ['CMP001,2025-01-01,-5,300,45.50,12', 'invalid_impressions'],
    ['CMP001,2025-01-01,12000,,45.50,12', 'invalid_clicks'],
    ['CMP001,2025-01-01,12000,300,$45.50,12', 'invalid_spend'],
    ['CMP001,2025-01-01,12000,300,45.50,twelve', 'invalid_conversions'],
  ])('rejects %j as %s', (line, reason) => {
    expect(parser.parse(line)).toEqual({ ok: false, reason });
  });
});
