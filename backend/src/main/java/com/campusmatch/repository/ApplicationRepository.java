package com.campusmatch.repository;

import com.campusmatch.entity.Application;
import com.campusmatch.entity.ApplicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ApplicationRepository extends JpaRepository<Application, Long> {

    interface PendingApplicationCount {
        Long getGroupId();
        Long getPendingCount();
    }

    List<Application> findByGroupId(Long groupId);

    List<Application> findByGroupIdOrderByCreatedAtDesc(Long groupId);

    List<Application> findByApplicantId(Long applicantId);

    Optional<Application> findByGroupIdAndApplicantId(Long groupId, Long applicantId);

    long countByGroupIdAndStatus(Long groupId, ApplicationStatus status);

    @Query("SELECT a.group.id AS groupId, COUNT(a) AS pendingCount " +
            "FROM Application a WHERE a.group.id IN :groupIds AND a.status = :status " +
            "GROUP BY a.group.id")
    List<PendingApplicationCount> countByGroupIdsAndStatus(
            @Param("groupIds") List<Long> groupIds,
            @Param("status") ApplicationStatus status);

    boolean existsByGroupIdAndApplicantId(Long groupId, Long applicantId);

    void deleteByGroupId(Long groupId);
}

