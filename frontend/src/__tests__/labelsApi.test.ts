import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}));

import { apiClient } from '../api/apiClient';
import {
  fetchLabels,
  createLabel,
  updateLabel,
  deleteLabel,
  replaceCardLabels,
} from '../api/labelsApi';

const mockApiClient = apiClient as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

const fixtureBoardId = 'board-1';
const fixtureLabelId = 'lbl-1';
const fixtureCardId = 'card-1';

const fixtureLabel = {
  id: fixtureLabelId,
  name: 'bug',
  color: '#be123c',
  icon: null,
};

describe('labelsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchLabels', () => {
    it('calls GET /api/boards/:boardId/labels and returns label array', async () => {
      const labels = [fixtureLabel, { id: 'lbl-2', name: 'feature', color: '#047857', icon: null }];
      mockApiClient.get.mockResolvedValue(labels);

      const result = await fetchLabels(fixtureBoardId);

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/boards/board-1/labels');
      expect(result).toEqual(labels);
    });

    it('returns empty array when board has no labels', async () => {
      mockApiClient.get.mockResolvedValue([]);

      const result = await fetchLabels(fixtureBoardId);

      expect(result).toEqual([]);
    });
  });

  describe('createLabel', () => {
    it('calls POST /api/boards/:boardId/labels with request body and returns created label', async () => {
      const createData = { name: 'bug', color: '#be123c' };
      mockApiClient.post.mockResolvedValue(fixtureLabel);

      const result = await createLabel(fixtureBoardId, createData);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/boards/board-1/labels',
        createData,
      );
      expect(result).toEqual(fixtureLabel);
    });

    it('includes optional icon field in request when provided', async () => {
      const createData = { name: 'star', color: '#0369a1', icon: '⭐' };
      mockApiClient.post.mockResolvedValue({ ...fixtureLabel, icon: '⭐' });

      await createLabel(fixtureBoardId, createData);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/boards/board-1/labels',
        createData,
      );
    });
  });

  describe('updateLabel', () => {
    it('calls PATCH /api/boards/:boardId/labels/:labelId with update body and returns updated label', async () => {
      const updateData = { name: 'critical bug' };
      const updatedLabel = { ...fixtureLabel, name: 'critical bug' };
      mockApiClient.patch.mockResolvedValue(updatedLabel);

      const result = await updateLabel(fixtureBoardId, fixtureLabelId, updateData);

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        '/api/boards/board-1/labels/lbl-1',
        updateData,
      );
      expect(result).toEqual(updatedLabel);
    });
  });

  describe('deleteLabel', () => {
    it('calls DELETE /api/boards/:boardId/labels/:labelId and returns void', async () => {
      mockApiClient.delete.mockResolvedValue(undefined);

      const result = await deleteLabel(fixtureBoardId, fixtureLabelId);

      expect(mockApiClient.delete).toHaveBeenCalledWith(
        '/api/boards/board-1/labels/lbl-1',
      );
      expect(result).toBeUndefined();
    });
  });

  describe('replaceCardLabels', () => {
    it('calls PUT /api/cards/:cardId/labels with labelIds body and returns labels response', async () => {
      const labelIds = ['lbl-1', 'lbl-2'];
      const responsePayload = { labels: [fixtureLabel, { id: 'lbl-2', name: 'feature', color: '#047857', icon: null }] };
      mockApiClient.put.mockResolvedValue(responsePayload);

      const result = await replaceCardLabels(fixtureCardId, labelIds);

      expect(mockApiClient.put).toHaveBeenCalledWith(
        '/api/cards/card-1/labels',
        { labelIds },
      );
      expect(result).toEqual(responsePayload);
    });

    it('calls PUT with empty labelIds array to remove all labels', async () => {
      const responsePayload = { labels: [] };
      mockApiClient.put.mockResolvedValue(responsePayload);

      const result = await replaceCardLabels(fixtureCardId, []);

      expect(mockApiClient.put).toHaveBeenCalledWith(
        '/api/cards/card-1/labels',
        { labelIds: [] },
      );
      expect(result).toEqual(responsePayload);
    });
  });
});
