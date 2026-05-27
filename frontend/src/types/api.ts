// REST request/response DTOs for the BanyanBoard backend API.
// Domain-shape types (Board, Column, Card, Label) live in domain.ts.
// This file covers wire-format shapes that carry request payloads.

/** POST /api/columns/:columnId/cards — request body */
export interface CreateCardRequest {
  title: string;
  description?: string | null;
  dueDate?: string | null;
}

/** PATCH /api/cards/:cardId — request body (at least one field required) */
export interface UpdateCardRequest {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  columnId?: string;
  position?: number;
}

/** GET /api/boards — list item (lightweight, no nested columns) */
export interface BoardListItem {
  id: string;
  name: string;
  updatedAt: string;
}

/** Error response envelope returned by all endpoints on 4xx/5xx */
export interface ApiError {
  error: {
    message: string;
    traceId?: string;
    issues?: Array<{ message: string; path: Array<string | number> }>;
  };
}

/** POST /api/boards/:boardId/labels — request body */
export interface CreateLabelRequest {
  name: string;
  color: string;
  icon?: string | null;
}

/** PATCH /api/boards/:boardId/labels/:labelId — request body */
export interface UpdateLabelRequest {
  name?: string;
  color?: string;
  icon?: string | null;
}

/** PUT /api/cards/:cardId/labels — request body */
export interface ReplaceCardLabelsRequest {
  labelIds: string[];
}

/** PUT /api/cards/:cardId/labels — response body */
export interface ReplaceCardLabelsResponse {
  labels: import('./domain').Label[];
}
