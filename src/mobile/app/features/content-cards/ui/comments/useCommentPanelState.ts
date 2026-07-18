import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, TextInput, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardInset } from "../../../../shared/hooks/useKeyboardInset";
import type { CommentItem, SearchUserResult } from "../../data";
import {
  buildRepliesByParentId,
  normalizeComments,
  normalizeParentId,
} from "../../domain/commentPanel.helpers";
import { useCommentLikesSheet } from "./useCommentLikesSheet";

interface UseCommentPanelStateParams {
  comments: CommentItem[];
  onOpenCommentLikes?: (comment: CommentItem) => Promise<SearchUserResult[]> | SearchUserResult[];
  onSubmit: (text: string, parentId: string | null) => Promise<void> | void;
  visible: boolean;
}

export function useCommentPanelState({
  comments,
  onOpenCommentLikes,
  onSubmit,
  visible,
}: UseCommentPanelStateParams) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboardInset = useKeyboardInset(visible);
  const inputRef = useRef<TextInput | null>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const likesSheet = useCommentLikesSheet({ onOpenCommentLikes });
  const { resetCommentLikesSheet } = likesSheet;

  useEffect(() => {
    if (visible) return;
    setText("");
    setReplyTo(null);
    setExpandedReplies(new Set());
    setSubmitting(false);
    setSubmitError("");
    setInputFocused(false);
    resetCommentLikesSheet();
  }, [resetCommentLikesSheet, visible]);

  const normalizedComments = useMemo(() => normalizeComments(comments), [comments]);
  const topLevelComments = useMemo(
    () => normalizedComments.filter((item) => item.parentId === null),
    [normalizedComments],
  );
  const repliesByParentId = useMemo(
    () => buildRepliesByParentId(normalizedComments),
    [normalizedComments],
  );

  const keyboardSafetyOffset = keyboardInset > 0 ? (Platform.OS === "android" ? 42 : 18) : 0;
  const sheetBottomInset = Math.max(0, keyboardInset + keyboardSafetyOffset);
  const maxSheetHeight = Math.max(280, windowHeight - insets.top - sheetBottomInset - 10);
  const sheetHeight = Math.min(Math.floor(windowHeight * 0.88), maxSheetHeight);
  const composerBottomPadding =
    sheetBottomInset > 0 ? (Platform.OS === "android" ? 18 : 12) : Math.max(insets.bottom, 8);

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const expandReplyThread = (comment: CommentItem) => {
    const rootParentId = normalizeParentId(comment.parentId) || comment.id;
    setExpandedReplies((prev) => new Set(prev).add(rootParentId));
    return rootParentId;
  };

  const handleReply = (comment: CommentItem) => {
    expandReplyThread(comment);
    setReplyTo(comment);
    setText(`@${comment.username} `);
    setSubmitError("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleTextChange = (value: string) => {
    setText(value);
    if (submitError) {
      setSubmitError("");
    }
  };

  const submitComment = async (value: string, parentOverride?: string | null) => {
    const trimmed = value.trim();
    if (!trimmed || submitting) return;

    const parentId =
      parentOverride !== undefined
        ? parentOverride
        : replyTo
          ? normalizeParentId(replyTo.parentId) || replyTo.id
          : null;

    setSubmitting(true);
    setSubmitError("");
    try {
      await onSubmit(trimmed, parentId);
      if (replyTo && parentId) {
        setExpandedReplies((prev) => new Set(prev).add(parentId));
      }
      setText("");
      setReplyTo(null);
    } catch (error) {
      setSubmitError(
        String(
          (error as { message?: string } | null)?.message || "Yorum gonderilemedi. Tekrar dene.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickReaction = async (reaction: string) => {
    if (submitting) return;
    setSubmitError("");
    setText((prev) => `${prev}${prev.trim() ? " " : ""}${reaction}`);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return {
    canSend: text.trim().length > 0 && !submitting,
    composerBottomPadding,
    expandedReplies,
    inputFocused,
    inputRef,
    likesSheet,
    normalizedCommentCount: normalizedComments.length,
    replyTo,
    repliesByParentId,
    setInputFocused,
    setReplyTo,
    setText: handleTextChange,
    submitError,
    sheetBottomInset,
    sheetHeight,
    submit: () => submitComment(text),
    text,
    toggleReplies,
    topLevelComments,
    handleQuickReaction,
    handleReply,
  };
}
