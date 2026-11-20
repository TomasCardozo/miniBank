package minibank.minibank.audit.controller;

import minibank.minibank.audit.dto.AuditLogFilterRequest;
import minibank.minibank.audit.dto.AuditLogResponse;
import minibank.minibank.audit.entity.AuditAction;
import minibank.minibank.audit.entity.AuditEntityType;
import minibank.minibank.audit.service.AuditService;
import minibank.minibank.common.dto.PageResponse;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/admin/audit-logs")
public class AuditController {

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "createdAt");
    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of("createdAt", "action", "entityType");

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    PageResponse<AuditLogResponse> list(
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) AuditAction action,
            @RequestParam(required = false) AuditEntityType entityType,
            @RequestParam(required = false) UUID entityId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            Pageable pageable
    ) {
        return PageResponse.from(auditService.list(
                new AuditLogFilterRequest(userId, action, entityType, entityId, from, to),
                withDefaultSort(pageable)
        ));
    }

    private Pageable withDefaultSort(Pageable pageable) {
        if (pageable.getSort().isSorted()) {
            validateSort(pageable.getSort());
            return pageable;
        }

        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), DEFAULT_SORT);
    }

    private void validateSort(Sort sort) {
        for (Sort.Order order : sort) {
            if (!ALLOWED_SORT_FIELDS.contains(order.getProperty())) {
                throw new BusinessException(
                        ErrorCodes.VALIDATION_ERROR,
                        "Unsupported audit log sort field",
                        HttpStatus.BAD_REQUEST
                );
            }
        }
    }
}
