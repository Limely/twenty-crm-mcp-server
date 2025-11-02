import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { TwentyCRMServer } from '../index.js';

describe('Field Normalization', () => {
  let server;

  before(() => {
    process.env.TWENTY_API_KEY = 'test-key';
    process.env.TWENTY_BASE_URL = 'https://test.twenty.com';
    process.env.SCHEMA_PATH = './schema';
    server = new TwentyCRMServer({ quiet: true });
  });

  describe('normalizeEmailsValue', () => {
    it('should normalize a simple email string', () => {
      const result = server.normalizeEmailsValue('test@example.com');
      assert.deepStrictEqual(result, {
        primaryEmail: 'test@example.com',
        additionalEmails: null
      });
    });

    it('should normalize an array of emails', () => {
      const result = server.normalizeEmailsValue(['primary@example.com', 'secondary@example.com']);
      assert.strictEqual(result.primaryEmail, 'primary@example.com');
      assert.ok(Array.isArray(result.additionalEmails));
      assert.strictEqual(result.additionalEmails.length, 1);
      assert.strictEqual(result.additionalEmails[0].value, 'secondary@example.com');
    });

    it('should return already formatted emails as-is', () => {
      const input = {
        primaryEmail: 'test@example.com',
        additionalEmails: null
      };
      const result = server.normalizeEmailsValue(input);
      assert.deepStrictEqual(result, input);
    });
  });

  describe('normalizePhonesValue', () => {
    it('should normalize a simple phone string', () => {
      const result = server.normalizePhonesValue('+41 44 123 45 67');
      assert.deepStrictEqual(result, {
        primaryPhoneNumber: '+41 44 123 45 67',
        primaryPhoneCallingCode: '',
        primaryPhoneCountryCode: '',
        additionalPhones: null
      });
    });

    it('should normalize an array of phones', () => {
      const result = server.normalizePhonesValue([
        { number: '+41 44 123 45 67', countryCode: 'CH', callingCode: '+41' },
        '+41 44 987 65 43'
      ]);
      assert.strictEqual(result.primaryPhoneNumber, '+41 44 123 45 67');
      assert.strictEqual(result.primaryPhoneCountryCode, 'CH');
      assert.strictEqual(result.primaryPhoneCallingCode, '+41');
      assert.ok(Array.isArray(result.additionalPhones));
      assert.strictEqual(result.additionalPhones.length, 1);
    });
  });

  describe('normalizeAddressValue', () => {
    it('should normalize a simple address string', () => {
      const result = server.normalizeAddressValue('Gotthardstrasse 63, 6438 Ibach');
      assert.strictEqual(result.addressStreet1, 'Gotthardstrasse 63, 6438 Ibach');
      assert.strictEqual(result.addressCity, '');
      assert.strictEqual(result.addressCountry, '');
    });

    it('should convert standard address format to Twenty format', () => {
      const result = server.normalizeAddressValue({
        street1: 'Gotthardstrasse 63',
        city: 'Ibach',
        postalCode: '6438',
        country: 'Switzerland'
      });
      assert.strictEqual(result.addressStreet1, 'Gotthardstrasse 63');
      assert.strictEqual(result.addressCity, 'Ibach');
      assert.strictEqual(result.addressPostcode, '6438');
      assert.strictEqual(result.addressCountry, 'Switzerland');
    });

    it('should convert addressLine1/2 format to Twenty format', () => {
      const result = server.normalizeAddressValue({
        addressLine1: 'Bahnhofstrasse 27',
        addressLine2: 'c/o Aukofer',
        city: 'Möhlin',
        state: 'AG',
        zip: '4313',
        country: 'Schweiz'
      });
      assert.strictEqual(result.addressStreet1, 'Bahnhofstrasse 27');
      assert.strictEqual(result.addressStreet2, 'c/o Aukofer');
      assert.strictEqual(result.addressCity, 'Möhlin');
      assert.strictEqual(result.addressState, 'AG');
      assert.strictEqual(result.addressPostcode, '4313');
      assert.strictEqual(result.addressCountry, 'Schweiz');
    });

    it('should return already formatted address as-is', () => {
      const input = {
        addressStreet1: 'Gotthardstrasse 63',
        addressStreet2: '',
        addressCity: 'Ibach',
        addressState: 'Schwyz',
        addressPostcode: '6438',
        addressCountry: 'Switzerland',
        addressLat: null,
        addressLng: null
      };
      const result = server.normalizeAddressValue(input);
      assert.deepStrictEqual(result, input);
    });
  });

  describe('normalizeLinksValue', () => {
    it('should normalize a simple URL string', () => {
      const result = server.normalizeLinksValue('https://schweglerbeck.ch');
      assert.deepStrictEqual(result, {
        primaryLinkUrl: 'https://schweglerbeck.ch',
        primaryLinkLabel: '',
        secondaryLinks: null
      });
    });

    it('should return already formatted links as-is', () => {
      const input = {
        primaryLinkUrl: 'https://schweglerbeck.ch',
        primaryLinkLabel: 'Website',
        secondaryLinks: null
      };
      const result = server.normalizeLinksValue(input);
      assert.deepStrictEqual(result, input);
    });
  });
});
