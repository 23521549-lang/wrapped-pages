"use client";

import { IconDung } from "@/components/media/icons";
import { UploadFailure, UploadProgress, UploadThumb } from "@/components/media/UploadLine";
import { IMAGE_ERRORS, IMAGE_HINTS, imageRetryable } from "@/lib/media/image";
import { IMAGE_STATUS, type ImageUploadState } from "./useImageUpload";

type Props = {
  state: ImageUploadState;
  /** Mo lai hop chon tep. */
  onPick: () => void;
  onRetry: () => void;
  /** Huy luot dang chay hoac dong dong loi. */
  onClose: () => void;
};

/**
 * Dong tai anh o hang phu cua man viet, ve bang dong tai dung chung (UploadLine). Cau doc di qua vung doc
 * chung cua man viet.
 */
export function ImageUploadLine({ state, onPick, onRetry, onClose }: Props) {
  switch (state.kind) {
    case "nghi":
      return null;
    case "xong":
      return (
        <div className="tai-anh tai-anh--gon">
          <UploadThumb preview={state.preview} />
          <div className="tai-anh__than">
            <p className="tai-anh__chu tai-anh__chu--xong"><IconDung />{IMAGE_STATUS.xong}</p>
          </div>
        </div>
      );
    case "loi":
      return (
        <UploadFailure
          message={IMAGE_ERRORS[state.problem]}
          hint={IMAGE_HINTS[state.problem] ?? null}
          preview={state.preview}
          onRetry={imageRetryable(state.problem) ? onRetry : null}
          onPick={onPick}
          onClose={onClose}
        />
      );
    default:
      return (
        <UploadProgress
          label={IMAGE_STATUS[state.kind]}
          cancelLabel="Hủy tải ảnh"
          preview={state.kind === "tai-len" ? state.preview : null}
          onCancel={onClose}
        />
      );
  }
}
