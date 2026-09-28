package studio.webgame.ghostdesk;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.dao.DataAccessResourceFailureException;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers=CatalogController.class, properties="app.allowed-origins=https://game.example")
class CatalogControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean CatalogMapper mapper;

    @Test void livenessDoesNotTouchSleepingDatabase() throws Exception {
        mvc.perform(get("/health/live")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));
        verifyNoInteractions(mapper);
    }
    @Test void readinessRequiresPublishedContent() throws Exception {
        when(mapper.publishedCount()).thenReturn(0);
        mvc.perform(get("/health/ready")).andExpect(status().isServiceUnavailable());
        when(mapper.publishedCount()).thenReturn(1);
        mvc.perform(get("/health/ready")).andExpect(status().isOk()).andExpect(jsonPath("$.publishedCases").value(1));
    }
    @Test void missingVersionReturns404() throws Exception {
        mvc.perform(get("/api/v1/ghostdesk/versions/missing/package")).andExpect(status().isNotFound());
    }
    @Test void packageIsJsonAndReadOnly() throws Exception {
        when(mapper.packageJson("demo-v1")).thenReturn("{\"versionId\":\"demo-v1\"}");
        mvc.perform(get("/api/v1/ghostdesk/versions/demo-v1/package")).andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith("application/json")).andExpect(jsonPath("$.versionId").value("demo-v1"));
        mvc.perform(post("/api/v1/ghostdesk/versions/demo-v1/package")).andExpect(status().isMethodNotAllowed());
    }
    @Test void sqlDetailsDoNotLeak() throws Exception {
        when(mapper.catalog()).thenThrow(new DataAccessResourceFailureException("secret connection detail"));
        mvc.perform(get("/api/v1/ghostdesk/catalog")).andExpect(status().isServiceUnavailable())
            .andExpect(content().json("{\"error\":\"temporarily_unavailable\"}"));
    }
    @Test void corsAllowsOnlyConfiguredSite() throws Exception {
        when(mapper.catalog()).thenReturn(List.of());
        mvc.perform(get("/api/v1/ghostdesk/catalog").header("Origin", "https://game.example"))
            .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "https://game.example"));
        mvc.perform(get("/api/v1/ghostdesk/catalog").header("Origin", "https://untrusted.example"))
            .andExpect(status().isForbidden());
    }
}
