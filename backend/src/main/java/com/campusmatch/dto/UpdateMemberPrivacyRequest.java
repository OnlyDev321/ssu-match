package com.campusmatch.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class UpdateMemberPrivacyRequest {
    /** true để ẩn danh, false để hiển thị hồ sơ. */
    private boolean anonymous;
}
