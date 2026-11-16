package com.campusmatch.repository;

import com.campusmatch.entity.GroupMember;
import com.campusmatch.entity.GroupMemberId;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupMemberRepository extends JpaRepository<GroupMember, GroupMemberId> {

    interface GroupMemberCount {
        Long getGroupId();
        Long getMemberCount();
    }

    List<GroupMember> findByGroupId(Long groupId);

    @EntityGraph(attributePaths = "user")
    @Query("SELECT gm FROM GroupMember gm WHERE gm.group.id = :groupId")
    List<GroupMember> findDetailMembersByGroupId(@Param("groupId") Long groupId);

    @EntityGraph(attributePaths = {"group", "group.leader"})
    List<GroupMember> findByUserId(Long userId);

    @EntityGraph(attributePaths = {"group", "user"})
    List<GroupMember> findByGroupIdIn(List<Long> groupIds);

    @Query("SELECT gm.group.id AS groupId, COUNT(gm) AS memberCount " +
            "FROM GroupMember gm WHERE gm.group.id IN :groupIds GROUP BY gm.group.id")
    List<GroupMemberCount> countMembersByGroupIds(@Param("groupIds") List<Long> groupIds);

    Optional<GroupMember> findByGroupIdAndUserId(Long groupId, Long userId);

    long countByGroupId(Long groupId);

    boolean existsByGroupIdAndUserId(Long groupId, Long userId);

    void deleteByGroupId(Long groupId);
}

