/** Spec 17: community shapes, from the generated OpenAPI types. */
import type { Schema } from "../api/typed";

export type CommunityBrief = Schema<"CommunityBriefSchema">;
export type Community = Schema<"CommunitySchema">;
export type CommunityDetail = Schema<"CommunityDetailSchema">;
export type CommunityPost = Schema<"PostSchema">;
export type CommunityComment = Schema<"CommentSchema">;
export type Feed = Schema<"FeedSchema">;
export type CommentPage = Schema<"CommunityCommentPage">;
export type MyCommunities = Schema<"MyCommunitiesSchema">;
export type AdminCommunity = Schema<"AdminCommunitySchema">;

/** "Ward (registration area)" wherever people see the level (spec 16 §19.6). */
export const LEVEL_WORDS: Record<string, string> = {
  national: "National", state: "State", lga: "LGA", ward: "Ward (registration area)", polling_unit: "Polling unit",
};

export const communityHref = (path: string) => `/communities/${path}`;
export const postHref = (path: string, id: string) => `/communities/${path}/posts/${id}`;
